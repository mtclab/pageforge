import { beforeEach, describe, expect, it } from 'vitest';
import type { SiteData } from '../src/engine/types.js';
import { ControlPlane, type Site } from '../src/worker/db.js';
import worker from '../src/worker/index.js';
import { MockProvider } from '../src/worker/payments.js';
import { sha256Hex } from '../src/worker/shared.js';
import { signSessionCookie } from '../src/worker/session.js';
import minimal from './fixtures/minimal.json';
import { workerEnv } from './worker-fixture.js';

const operatorKey = 'operator-secret';
const base = minimal as SiteData;

function tokenFor(siteId: string): string {
  return siteId.repeat(4);
}

function claimRequest(
  siteId: string,
  previewToken: string,
  fields: Record<string, string>,
): Request {
  return new Request(`https://example.test/claim/${siteId}?t=${previewToken}`, {
    method: 'POST',
    body: new URLSearchParams({ t: previewToken, ...fields }),
  });
}

async function mockWebhook(
  env: ReturnType<typeof workerEnv>,
  orderRef: string,
  type: string,
): Promise<Response> {
  const body = new URLSearchParams({ type, orderRef }).toString();
  const signature = await new MockProvider(operatorKey).signature(body);
  return worker.fetch(new Request('https://example.test/api/billing/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'mock-signature': signature,
    },
    body,
  }), env);
}

describe('S11 outbound draft claim flow', () => {
  let env: ReturnType<typeof workerEnv>;
  let cp: ControlPlane;

  beforeEach(() => {
    env = workerEnv();
    cp = new ControlPlane(env.DB);
  });

  async function seedSite(publicId: string, prospectId?: number): Promise<Site> {
    await cp.createSite({
      publicId,
      approvalKeyHash: await sha256Hex('approval-secret'),
      data: { ...base, name: `Yritys ${publicId}`, lang: 'fi' },
      ...(prospectId === undefined ? {} : { prospectId }),
      actor: 'operator',
    });
    const site = (await cp.getSiteByPublicId(publicId))!;
    await cp.createPreviewToken({
      tokenHash: await sha256Hex(tokenFor(publicId)),
      site,
      label: 'claim',
      expiresAt: Date.now() + 60_000,
      actor: 'operator',
    });
    return site;
  }

  const validFields = {
    name: 'Matti Meikäläinen',
    email: 'matti@example.fi',
    phone: '+358 40 123 4567',
    domain_wish: 'esimerkki.fi',
    message: 'Soittakaa iltapäivällä.',
  };

  it('gates access like previews, accepts proposal-scoped tokens, and allows operator sessions', async () => {
    const site = await seedSite('gate0001');
    await cp.createProposal({
      site,
      publicId: 'proposal',
      candidate: { ...site.data, name: 'Ehdotus' },
      summary: ['name changed'],
      actor: 'operator',
    });
    const scoped = '22222222222222222222222222222222';
    await cp.createPreviewToken({
      tokenHash: await sha256Hex(scoped),
      site,
      proposalPublicId: 'proposal',
      label: 'scoped',
      expiresAt: Date.now() + 60_000,
      actor: 'operator',
    });

    expect((await worker.fetch(new Request('https://example.test/claim/gate0001?t=bad'), env)).status).toBe(404);
    const scopedPage = await worker.fetch(
      new Request(`https://example.test/claim/gate0001?t=${scoped}`),
      env,
    );
    expect(scopedPage.status).toBe(200);
    expect(await scopedPage.text()).toContain('name="domain_wish"');

    const session = await signSessionCookie(operatorKey);
    const operatorPage = await worker.fetch(
      new Request('https://example.test/claim/gate0001', {
        headers: { cookie: `pf_admin=${session.value}` },
      }),
      env,
    );
    expect(operatorPage.status).toBe(200);
    expect(await operatorPage.text()).toContain('name="t" value=""');
  });

  it('shows the CTA only on eligible tokened previews', async () => {
    const site = await seedSite('banner01');
    const token = tokenFor(site.publicId);
    const preview = await worker.fetch(
      new Request(`https://example.test/p/banner01/current?t=${token}`),
      env,
    );
    const previewHtml = await preview.text();
    expect(previewHtml).toContain('Ota tämä sivu käyttöön - 249 € + 19 €/kk');
    expect(previewHtml).toContain(`/claim/banner01?t=${token}`);
    expect(previewHtml).toContain('Katso ensin, maksa vasta sitten.');

    await cp.publishSiteVersion(site, site.currentVersion, 'operator', 'test');
    const publishedPreviewHtml = await (await worker.fetch(
      new Request(`https://example.test/p/banner01/current?t=${token}`),
      env,
    )).text();
    expect(publishedPreviewHtml).not.toContain('Ota tämä sivu käyttöön');
    const reserved = await worker.fetch(
      new Request(`https://example.test/claim/banner01?t=${token}`),
      env,
    );
    expect(await reserved.text()).toContain('Tämä sivu on jo varattu / tilattu');
    const publicHtml = await (await worker.fetch(
      new Request('https://example.test/b/banner01'),
      env,
    )).text();
    expect(publicHtml).not.toContain('Ota tämä sivu käyttöön');
  });

  it('creates and pays a linked order, advances the prospect, and grants entitlement', async () => {
    await cp.createProspect({
      publicId: 'pros0001',
      name: 'Prospekti',
      status: 'arvioitu',
      actor: 'operator',
    });
    const prospect = (await cp.getProspect('pros0001'))!;
    const site = await seedSite('happy001', prospect.id);
    const token = tokenFor(site.publicId);
    const response = await worker.fetch(claimRequest(site.publicId, token, validFields), env);
    expect(response.status).toBe(303);
    const checkoutPath = response.headers.get('location')!;
    expect(checkoutPath).toMatch(/^\/mock-checkout\/[a-z0-9]{8}$/);

    const claims = await cp.listClaims('uusi');
    expect(claims).toHaveLength(1);
    expect(claims[0]).toEqual(expect.objectContaining({
      siteId: site.id,
      name: validFields.name,
      email: validFields.email,
      phone: validFields.phone,
      domainWish: validFields.domain_wish,
      message: validFields.message,
      orderStatus: 'luotu',
    }));
    expect((await cp.getProspect('pros0001'))?.status).toBe('vastasi');
    const order = await cp.getOrderByPublicId(checkoutPath.split('/').pop()!);
    expect(order).not.toBeNull();
    expect((await cp.getClaimByOrderId(order!.id))?.id).toBe(claims[0]!.id);

    const orderAudit = await cp.listAuditEvents({
      entity: 'order',
      entityId: order!.publicId,
      limit: 10,
    });
    expect(orderAudit.find((event) => event.action === 'order.create')?.detail).toEqual({
      siteId: site.publicId,
      provider: 'mock',
      channel: 'claim',
    });
    expect((await mockWebhook(env, order!.publicId, 'checkout.session.completed')).status).toBe(200);
    expect((await cp.getClaimByOrderId(order!.id))?.status).toBe('maksettu');
    expect(await cp.siteIsEntitled(site.id)).toBe(true);
    const claimAudit = await cp.listAuditEvents({
      entity: 'claim',
      entityId: String(claims[0]!.id),
      limit: 10,
    });
    expect(claimAudit.map((event) => event.action)).toEqual([
      'claim.paid',
      'claim.order',
      'claim.create',
    ]);
    const thanks = await worker.fetch(
      new Request(`https://example.test/order/${order!.publicId}/kiitos`),
      env,
    );
    expect(await thanks.text()).toContain('Kiitos! Otamme yhteyttä ja julkaisemme sivun pian.');
  });

  it('returns a friendly 409 for duplicate claims and cancels claims from webhooks', async () => {
    const site = await seedSite('dupe0001');
    const token = tokenFor(site.publicId);
    const first = await worker.fetch(claimRequest(site.publicId, token, validFields), env);
    expect(first.status).toBe(303);
    const duplicate = await worker.fetch(claimRequest(site.publicId, token, validFields), env);
    expect(duplicate.status).toBe(409);
    expect(await duplicate.text()).toContain('Tämä sivu on jo varattu / tilattu');

    const orderRef = first.headers.get('location')!.split('/').pop()!;
    expect((await mockWebhook(env, orderRef, 'checkout.session.expired')).status).toBe(200);
    const order = (await cp.getOrderByPublicId(orderRef))!;
    expect((await cp.getClaimByOrderId(order.id))?.status).toBe('peruttu');
    expect((await cp.listAuditEvents({
      entity: 'claim',
      entityId: String((await cp.getClaimByOrderId(order.id))!.id),
      limit: 10,
    }))[0]?.action).toBe('claim.cancel');
  });

  it('validates domain wishes and enforces the five-per-site daily limit', async () => {
    const site = await seedSite('guard001');
    const token = tokenFor(site.publicId);
    const badDomain = await worker.fetch(claimRequest(site.publicId, token, {
      ...validFields,
      domain_wish: 'https://Not-A-Domain.example/path',
    }), env);
    expect(badDomain.status).toBe(400);
    expect(await badDomain.text()).toContain('Virheellinen verkkotunnus');
    expect(await cp.listClaims()).toHaveLength(0);

    const day = new Date().toISOString().slice(0, 10);
    await env.SITES.put(`claimrl:${site.publicId}:${day}`, '5');
    const limited = await worker.fetch(claimRequest(site.publicId, token, validFields), env);
    expect(limited.status).toBe(429);
    expect(await cp.listClaims()).toHaveLength(0);
  });

  it('hides the banner for paid sites and escapes claim console surfaces', async () => {
    const paidSite = await seedSite('paid0001');
    const paidToken = tokenFor(paidSite.publicId);
    const paidOrder = await cp.createOrder({
      publicId: 'order001',
      site: paidSite,
      provider: 'mock',
      amountBuildCents: 24_900,
      amountMonthlyCents: 1_900,
      actor: 'operator',
    });
    await cp.transitionOrder(paidOrder, 'maksettu');
    const paidPreview = await worker.fetch(
      new Request(`https://example.test/p/paid0001/current?t=${paidToken}`),
      env,
    );
    expect(await paidPreview.text()).not.toContain('Ota tämä sivu käyttöön');
    const paidClaim = await worker.fetch(
      new Request(`https://example.test/claim/paid0001?t=${paidToken}`),
      env,
    );
    expect(await paidClaim.text()).toContain('Tämä sivu on jo varattu / tilattu');

    const hostileSite = await seedSite('escape01');
    await cp.createClaim({
      site: hostileSite,
      name: '<script>alert(1)</script>',
      email: 'evil@example.fi',
      phone: '<img src=x onerror=alert(1)>',
      domainWish: '<b>evil.fi</b>',
      message: '<svg onload=alert(1)>',
    });
    const session = await signSessionCookie(operatorKey);
    const headers = { cookie: `pf_admin=${session.value}` };
    const [dashboardHtml, listHtml, detailHtml] = await Promise.all([
      worker.fetch(new Request('https://example.test/admin', { headers }), env).then((r) => r.text()),
      worker.fetch(new Request('https://example.test/admin/claims?status=uusi', { headers }), env).then((r) => r.text()),
      worker.fetch(new Request('https://example.test/admin/sites/escape01', { headers }), env).then((r) => r.text()),
    ]);
    expect(dashboardHtml).toContain('Avoimet varaukset</div><div class="number">1</div>');
    for (const html of [listHtml, detailHtml]) {
      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).not.toContain('<svg onload=alert(1)>');
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    }
  });
});
