import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SiteData } from '../src/engine/types.js';
import { ControlPlane, type Order, type Site } from '../src/worker/db.js';
import worker from '../src/worker/index.js';
import {
  MockProvider,
  StripeProvider,
} from '../src/worker/payments.js';
import { LAUNCH_CHECKLIST_ITEMS } from '../src/worker/qa.js';
import { sha256Hex } from '../src/worker/shared.js';
import { signSessionCookie } from '../src/worker/session.js';
import minimal from './fixtures/minimal.json';
import { jsonRequest, workerEnv } from './worker-fixture.js';

const operatorKey = 'operator-secret';
const approvalKey = 'approval-secret';

async function mockWebhook(
  env: ReturnType<typeof workerEnv>,
  orderRef: string,
  type: string,
  timestamp?: number,
): Promise<Response> {
  const body = new URLSearchParams({ type, orderRef }).toString();
  const provider = new MockProvider(operatorKey);
  const signature = await provider.signature(body, timestamp);
  return worker.fetch(new Request('https://example.test/api/billing/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'mock-signature': signature,
    },
    body,
  }), env);
}

describe('S8 orders and mock billing lifecycle', () => {
  let env: ReturnType<typeof workerEnv>;
  let cp: ControlPlane;

  beforeEach(() => {
    env = workerEnv();
    cp = new ControlPlane(env.DB);
  });

  async function seedSite(publicId: string): Promise<Site> {
    await cp.createSite({
      publicId,
      approvalKeyHash: await sha256Hex(approvalKey),
      data: minimal as SiteData,
      actor: 'operator',
    });
    return (await cp.getSiteByPublicId(publicId))!;
  }

  async function createOrder(siteId: string, token = approvalKey): Promise<{
    response: Response;
    body: { orderId: string; redirectUrl: string };
  }> {
    const response = await worker.fetch(
      jsonRequest(`/api/biz/sites/${siteId}/order`, 'POST', {}, token),
      env,
    );
    return {
      response,
      body: await response.clone().json() as { orderId: string; redirectUrl: string },
    };
  }

  it('creates, pays, audits, appends raw events, and grants entitlement end to end', async () => {
    const site = await seedSite('payflow1');
    const { response, body } = await createOrder(site.publicId);
    expect(response.status).toBe(200);
    expect(body.redirectUrl).toBe(`/mock-checkout/${body.orderId}`);

    const created = await cp.getOrderByPublicId(body.orderId);
    expect(created).toEqual(expect.objectContaining({
      siteId: site.id,
      status: 'luotu',
      provider: 'mock',
      providerSessionId: `mock_${body.orderId}`,
      amountBuildCents: 24_900,
      amountMonthlyCents: 1_900,
      currency: 'eur',
    }));
    const checkout = await worker.fetch(
      new Request(`https://example.test${body.redirectUrl}`),
      env,
    );
    const checkoutHtml = await checkout.text();
    expect(checkoutHtml).toContain('Maksa (testi)');
    expect(checkoutHtml).toContain('Peruuta');

    const paid = await mockWebhook(env, body.orderId, 'checkout.session.completed');
    expect(paid.status).toBe(200);
    expect((await cp.getOrderByPublicId(body.orderId))?.status).toBe('maksettu');
    expect(await cp.siteIsEntitled(site.id)).toBe(true);
    const billing = await cp.listBillingEventsForSite(site.id);
    expect(billing).toHaveLength(1);
    expect(billing[0]).toEqual(expect.objectContaining({
      type: 'checkout.session.completed',
      payload: `type=checkout.session.completed&orderRef=${body.orderId}`,
    }));
    const audit = await cp.listAuditEvents({ entity: 'order', entityId: body.orderId, limit: 10 });
    expect(audit.map((event) => event.action)).toEqual(['order.paid', 'order.create']);
  });

  it('supports cancellation and failed-invoice paths without entitlement', async () => {
    const cancelledSite = await seedSite('cancel01');
    const cancelled = await createOrder(cancelledSite.publicId);
    expect((await mockWebhook(
      env,
      cancelled.body.orderId,
      'checkout.session.expired',
    )).status).toBe(200);
    expect((await cp.getOrderByPublicId(cancelled.body.orderId))?.status).toBe('peruttu');
    expect(await cp.siteIsEntitled(cancelledSite.id)).toBe(false);

    const failedSite = await seedSite('failed02');
    const failed = await createOrder(failedSite.publicId);
    expect((await mockWebhook(
      env,
      failed.body.orderId,
      'invoice.payment_failed',
    )).status).toBe(200);
    expect((await cp.getOrderByPublicId(failed.body.orderId))?.status).toBe('maksu_epaonnistui');
    const audit = await cp.listAuditEvents({ entity: 'order', entityId: failed.body.orderId, limit: 10 });
    expect(audit[0]).toEqual(expect.objectContaining({ action: 'order.failed' }));
  });

  it('ignores newer undecided orders when resolving the latest entitlement decision', async () => {
    const site = await seedSite('entdec01');
    const paid = await cp.createOrder({
      publicId: 'paid0001',
      site,
      provider: 'mock',
      amountBuildCents: 24_900,
      amountMonthlyCents: 1_900,
      actor: 'operator',
    });
    await cp.transitionOrder(paid, 'maksettu');
    expect(await cp.siteIsEntitled(site.id)).toBe(true);

    const undecided = await cp.createOrder({
      publicId: 'new00001',
      site,
      provider: 'mock',
      amountBuildCents: 24_900,
      amountMonthlyCents: 1_900,
      actor: 'operator',
    });
    expect(await cp.siteIsEntitled(site.id)).toBe(true);
    await cp.transitionOrder(undecided, 'irtisanottu');
    expect(await cp.siteIsEntitled(site.id)).toBe(false);
  });

  it('rejects a second open order with 409 and reads prices from environment', async () => {
    await seedSite('oneopen1');
    env.PRICE_BUILD_CENTS = '30000';
    env.PRICE_MONTHLY_CENTS = '2500';
    const first = await createOrder('oneopen1', operatorKey);
    expect(first.response.status).toBe(200);
    const second = await worker.fetch(
      jsonRequest('/api/biz/sites/oneopen1/order', 'POST', {}, operatorKey),
      env,
    );
    expect(second.status).toBe(409);
    expect(await cp.getOrderByPublicId(first.body.orderId)).toEqual(expect.objectContaining({
      amountBuildCents: 30_000,
      amountMonthlyCents: 2_500,
    }));
  });

  it('returns 400 for bad signatures and replayed timestamps without appending events', async () => {
    const site = await seedSite('badweb01');
    const created = await createOrder(site.publicId);
    const bad = await worker.fetch(new Request('https://example.test/api/billing/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'mock-signature': `t=${Math.floor(Date.now() / 1000)},v1=${'0'.repeat(64)}`,
      },
      body: `type=checkout.session.completed&orderRef=${created.body.orderId}`,
    }), env);
    expect(bad.status).toBe(400);

    const oldTimestamp = Math.floor(Date.now() / 1000) - 301;
    const replayed = await mockWebhook(
      env,
      created.body.orderId,
      'checkout.session.completed',
      oldTimestamp,
    );
    expect(replayed.status).toBe(400);
    expect(await cp.listBillingEventsForSite(site.id)).toEqual([]);
  });

  it('stores unknown valid events raw without changing state', async () => {
    const site = await seedSite('unknown1');
    const created = await createOrder(site.publicId);
    expect((await mockWebhook(env, created.body.orderId, 'customer.updated')).status).toBe(200);
    expect((await cp.getOrderByPublicId(created.body.orderId))?.status).toBe('luotu');
    expect(await cp.listBillingEventsForSite(site.id)).toEqual([
      expect.objectContaining({ type: 'customer.updated' }),
    ]);
  });

  it('blocks approval-key publish until paid and permits it after payment', async () => {
    const site = await seedSite('entitle1');
    await cp.recordQaRun(site, site.currentVersion, [{ id: 'ok', label: 'OK', passed: true }]);
    for (const item of LAUNCH_CHECKLIST_ITEMS) {
      await cp.checkLaunchChecklist(site, item.id, 'operator');
    }
    const blocked = await worker.fetch(
      jsonRequest('/api/biz/sites/entitle1/publish', 'POST', {}, approvalKey),
      env,
    );
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toEqual({ error: 'Tilaus ei ole maksettu.' });

    const created = await createOrder(site.publicId);
    expect((await mockWebhook(env, created.body.orderId, 'checkout.session.completed')).status).toBe(200);
    const published = await worker.fetch(
      jsonRequest('/api/biz/sites/entitle1/publish', 'POST', {}, approvalKey),
      env,
    );
    expect(published.status).toBe(200);
    expect((await cp.getSiteByPublicId(site.publicId))?.status).toBe('published');
  });

  it('shows Finnish order state, billing tail, dashboard counts, and safe result pages', async () => {
    const site = await seedSite('console8');
    const created = await createOrder(site.publicId, operatorKey);
    await mockWebhook(env, created.body.orderId, 'checkout.session.completed');
    const session = await signSessionCookie(operatorKey);
    const headers = { cookie: `pf_admin=${session.value}` };
    const detailHtml = await (await worker.fetch(
      new Request('https://example.test/admin/sites/console8', { headers }),
      env,
    )).text();
    expect(detailHtml).toContain('<h2>Tilaus</h2>');
    expect(detailHtml).toContain('<span class="badge">Maksettu</span>');
    expect(detailHtml).toContain('checkout.session.completed');
    expect(detailHtml).toContain('Luo tilaus');
    const dashboardHtml = await (await worker.fetch(
      new Request('https://example.test/admin', { headers }),
      env,
    )).text();
    expect(dashboardHtml).toContain('<h2>Tilaukset</h2>');
    expect(dashboardHtml).toContain('<span class="badge">Maksettu</span></div><div class="number">1</div>');

    for (const suffix of ['kiitos', 'peruttu']) {
      const response = await worker.fetch(
        new Request(`https://example.test/order/${created.body.orderId}/${suffix}`),
        env,
      );
      expect(response.status).toBe(200);
      expect(await response.text()).not.toContain(created.body.orderId);
    }
  });
});

describe('StripeProvider request and signature behavior', () => {
  const order: Order = {
    id: 1,
    publicId: 'stripe01',
    siteId: 2,
    kind: 'build_and_host',
    status: 'luotu',
    provider: 'stripe',
    amountBuildCents: 24_900,
    amountMonthlyCents: 1_900,
    currency: 'eur',
    createdAt: 1,
    updatedAt: 1,
  };

  it('creates the mixed subscription cart without dynamic-payment or tax overrides', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.test/cs_test_123',
    }), { headers: { 'content-type': 'application/json' } }));
    const provider = new StripeProvider('sk_test_secret', 'whsec_secret', fetcher);
    await expect(provider.createCheckout(order, {
      successUrl: 'https://example.test/order/stripe01/kiitos',
      cancelUrl: 'https://example.test/order/stripe01/peruttu',
    })).resolves.toEqual({
      redirectUrl: 'https://checkout.stripe.test/cs_test_123',
      sessionId: 'cs_test_123',
    });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer sk_test_secret');
    expect(new Headers(init?.headers).has('payment_method_types')).toBe(false);
    const params = new URLSearchParams(String(init?.body));
    expect(params.get('mode')).toBe('subscription');
    expect(params.get('client_reference_id')).toBe('stripe01');
    expect(params.get('subscription_data[metadata][order_ref]')).toBe('stripe01');
    expect(params.get('line_items[0][price_data][unit_amount]')).toBe('1900');
    expect(params.get('line_items[0][price_data][recurring][interval]')).toBe('month');
    expect(params.get('line_items[1][price_data][unit_amount]')).toBe('24900');
    expect([...params.keys()].some((key) => key.startsWith('payment_method_types'))).toBe(false);
    expect([...params.keys()].some((key) => key.startsWith('automatic_tax'))).toBe(false);
  });

  it('verifies the raw Stripe body and rejects bad or older-than-five-minute signatures', async () => {
    const now = 1_800_000_000_000;
    const nowSeconds = Math.floor(now / 1000);
    const raw = JSON.stringify({
      type: 'checkout.session.completed',
      data: { object: { client_reference_id: 'stripe01', subscription: 'sub_123' } },
    });
    const signer = new MockProvider('whsec_secret', () => now);
    const provider = new StripeProvider('sk_test', 'whsec_secret', vi.fn(), () => now);
    const valid = await signer.signature(raw, nowSeconds);
    const parsed = await provider.parseWebhook(new Request('https://example.test/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': valid },
      body: raw,
    }));
    expect(parsed).toEqual(expect.objectContaining({
      type: 'checkout.session.completed',
      orderRef: 'stripe01',
      providerSubId: 'sub_123',
      raw,
    }));

    const bad = await provider.parseWebhook(new Request('https://example.test/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': `t=${nowSeconds},v1=${'0'.repeat(64)}` },
      body: raw,
    }));
    expect(bad).toBeNull();
    const old = await signer.signature(raw, nowSeconds - 301);
    expect(await provider.parseWebhook(new Request('https://example.test/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': old },
      body: raw,
    }))).toBeNull();
  });
});
