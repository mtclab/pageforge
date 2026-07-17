import {
  type AuditActor,
  ControlPlane,
  type Order,
  type OrderStatus,
  type Site,
} from './db.js';
import { constantTimeEqual, type Env } from './shared.js';

export interface CheckoutUrls {
  successUrl: string;
  cancelUrl: string;
}

export interface ParsedPaymentEvent {
  type: string;
  orderRef: string;
  raw: string;
  providerSubId?: string;
}

export interface PaymentsProvider {
  readonly name: 'mock' | 'stripe';
  createCheckout(order: Order, urls: CheckoutUrls): Promise<{
    redirectUrl: string;
    sessionId: string;
  }>;
  parseWebhook(request: Request): Promise<ParsedPaymentEvent | null>;
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const encoder = new TextEncoder();

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return bytesToHex(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

function signatureParts(header: string | null): { timestamp: number; signatures: string[] } | null {
  if (!header) return null;
  let timestamp: number | undefined;
  const signatures: string[] = [];
  for (const component of header.split(',')) {
    const separator = component.indexOf('=');
    if (separator === -1) continue;
    const key = component.slice(0, separator).trim();
    const value = component.slice(separator + 1).trim();
    if (key === 't' && /^\d+$/.test(value)) timestamp = Number(value);
    if (key === 'v1' && /^[a-f0-9]{64}$/i.test(value)) signatures.push(value.toLowerCase());
  }
  return timestamp === undefined || !Number.isSafeInteger(timestamp) || signatures.length === 0
    ? null
    : { timestamp, signatures };
}

async function verifiedBody(
  request: Request,
  secret: string,
  headerName: string,
  nowSeconds: number,
  tolerateSeconds?: number,
): Promise<string | null> {
  const parts = signatureParts(request.headers.get(headerName)
    ?? new URL(request.url).searchParams.get(headerName));
  if (!parts) return null;
  if (tolerateSeconds !== undefined && Math.abs(nowSeconds - parts.timestamp) > tolerateSeconds) {
    return null;
  }
  const body = await request.text();
  const expected = await hmacHex(secret, `${parts.timestamp}.${body}`);
  return parts.signatures.some((signature) => constantTimeEqual(signature, expected)) ? body : null;
}

function eventInput(body: string, contentType: string | null): Record<string, unknown> | null {
  try {
    if (contentType?.includes('application/x-www-form-urlencoded')) {
      return Object.fromEntries(new URLSearchParams(body));
    }
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function stringAt(value: unknown, path: readonly string[]): string | undefined {
  let current = value;
  for (const part of path) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' && current ? current : undefined;
}

function stripeOrderRef(event: Record<string, unknown>): string {
  const paths = [
    ['data', 'object', 'client_reference_id'],
    ['data', 'object', 'metadata', 'order_ref'],
    ['data', 'object', 'subscription_details', 'metadata', 'order_ref'],
    ['data', 'object', 'parent', 'subscription_details', 'metadata', 'order_ref'],
    ['data', 'object', 'parent', 'subscription_details', 'subscription', 'metadata', 'order_ref'],
  ] as const;
  for (const path of paths) {
    const value = stringAt(event, path);
    if (value) return value;
  }
  return '';
}

function stripeSubscriptionId(event: Record<string, unknown>): string | undefined {
  return stringAt(event, ['data', 'object', 'subscription'])
    ?? stringAt(event, ['data', 'object', 'parent', 'subscription_details', 'subscription'])
    ?? (stringAt(event, ['data', 'object', 'object']) === 'subscription'
      ? stringAt(event, ['data', 'object', 'id'])
      : undefined);
}

export class MockProvider implements PaymentsProvider {
  readonly name = 'mock' as const;

  constructor(
    private readonly secret: string,
    private readonly now: () => number = Date.now,
  ) {}

  async createCheckout(order: Order, _urls: CheckoutUrls): Promise<{
    redirectUrl: string;
    sessionId: string;
  }> {
    return {
      redirectUrl: `/mock-checkout/${order.publicId}`,
      sessionId: `mock_${order.publicId}`,
    };
  }

  async signature(body: string, timestamp = Math.floor(this.now() / 1000)): Promise<string> {
    return `t=${timestamp},v1=${await hmacHex(this.secret, `${timestamp}.${body}`)}`;
  }

  async parseWebhook(request: Request): Promise<ParsedPaymentEvent | null> {
    const body = await verifiedBody(
      request,
      this.secret,
      'mock-signature',
      Math.floor(this.now() / 1000),
      300,
    );
    if (body === null) return null;
    const input = eventInput(body, request.headers.get('content-type'));
    if (!input || typeof input.type !== 'string' || typeof input.orderRef !== 'string') return null;
    return { type: input.type, orderRef: input.orderRef, raw: body };
  }
}

export class StripeProvider implements PaymentsProvider {
  readonly name = 'stripe' as const;

  constructor(
    private readonly secretKey: string,
    private readonly webhookSecret: string,
    private readonly fetcher: Fetcher = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async createCheckout(order: Order, urls: CheckoutUrls): Promise<{
    redirectUrl: string;
    sessionId: string;
  }> {
    const body = new URLSearchParams();
    body.set('mode', 'subscription');
    body.set('success_url', urls.successUrl);
    body.set('cancel_url', urls.cancelUrl);
    body.set('client_reference_id', order.publicId);
    body.set('subscription_data[metadata][order_ref]', order.publicId);
    body.set('line_items[0][quantity]', '1');
    body.set('line_items[0][price_data][currency]', order.currency);
    body.set('line_items[0][price_data][unit_amount]', String(order.amountMonthlyCents));
    body.set('line_items[0][price_data][recurring][interval]', 'month');
    body.set('line_items[0][price_data][product_data][name]', 'Mikoshi ylläpito');
    body.set('line_items[1][quantity]', '1');
    body.set('line_items[1][price_data][currency]', order.currency);
    body.set('line_items[1][price_data][unit_amount]', String(order.amountBuildCents));
    body.set('line_items[1][price_data][product_data][name]', 'Mikoshi verkkosivut');
    // TODO(owner gate): automatic_tax stays disabled until VAT treatment has accountant sign-off.
    const response = await this.fetcher('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.secretKey}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!response.ok) throw new Error(`Stripe Checkout failed (${response.status})`);
    const result = await response.json() as { id?: string; url?: string };
    if (!result.id || !result.url) throw new Error('Stripe Checkout returned an invalid session');
    return { redirectUrl: result.url, sessionId: result.id };
  }

  async parseWebhook(request: Request): Promise<ParsedPaymentEvent | null> {
    const raw = await verifiedBody(
      request,
      this.webhookSecret,
      'stripe-signature',
      Math.floor(this.now() / 1000),
      300,
    );
    if (raw === null) return null;
    const event = eventInput(raw, request.headers.get('content-type'));
    if (!event || typeof event.type !== 'string') return null;
    return {
      type: event.type,
      orderRef: stripeOrderRef(event),
      raw,
      ...(stripeSubscriptionId(event) === undefined
        ? {}
        : { providerSubId: stripeSubscriptionId(event) }),
    };
  }
}

export function paymentPrices(env: Env): { buildCents: number; monthlyCents: number } {
  const positiveInteger = (raw: string | undefined, fallback: string): number => {
    const value = Number(raw ?? fallback);
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Payment price must be a positive integer');
    return value;
  };
  return {
    buildCents: positiveInteger(env.PRICE_BUILD_CENTS, '24900'),
    monthlyCents: positiveInteger(env.PRICE_MONTHLY_CENTS, '1900'),
  };
}

export function paymentProvider(env: Env, fetcher?: Fetcher): PaymentsProvider {
  if (env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET) {
    return new StripeProvider(env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET, fetcher);
  }
  return new MockProvider(env.OPERATOR_KEY ?? '');
}

export function paymentStatusForEvent(
  type: string,
): Exclude<OrderStatus, 'luotu'> | undefined {
  switch (type) {
    case 'checkout.session.completed': return 'maksettu';
    case 'invoice.payment_failed': return 'maksu_epaonnistui';
    case 'customer.subscription.deleted': return 'irtisanottu';
    case 'checkout.session.expired': return 'peruttu';
    default: return undefined;
  }
}

export async function createOrderCheckout(
  cp: ControlPlane,
  env: Env,
  site: Site,
  origin: string,
  publicId: string,
  actor: Extract<AuditActor, 'operator' | 'approval-key'>,
): Promise<{ order: Order; redirectUrl: string }> {
  if (await cp.openOrderForSite(site.id)) throw new OpenOrderError();
  const provider = paymentProvider(env);
  const prices = paymentPrices(env);
  let order: Order;
  try {
    order = await cp.createOrder({
      publicId,
      site,
      provider: provider.name,
      amountBuildCents: prices.buildCents,
      amountMonthlyCents: prices.monthlyCents,
      actor,
    });
  } catch (error) {
    // The partial unique index is the final race-safe guard behind the read above.
    if (await cp.openOrderForSite(site.id)) throw new OpenOrderError();
    throw error;
  }
  try {
    const checkout = await provider.createCheckout(order, {
      successUrl: `${origin}/order/${order.publicId}/kiitos`,
      cancelUrl: `${origin}/order/${order.publicId}/peruttu`,
    });
    await cp.setOrderCheckout(order.id, checkout.sessionId);
    return { order: { ...order, providerSessionId: checkout.sessionId }, redirectUrl: checkout.redirectUrl };
  } catch (error) {
    await cp.transitionOrder(order, 'maksu_epaonnistui');
    throw error;
  }
}

export class OpenOrderError extends Error {
  constructor() {
    super('site already has an open order');
    this.name = 'OpenOrderError';
  }
}

const ORDER_ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export async function unusedOrderId(cp: ControlPlane): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const id = [...bytes]
      .map((byte) => ORDER_ID_ALPHABET[byte % ORDER_ID_ALPHABET.length])
      .join('');
    if (!(await cp.getOrderByPublicId(id))) return id;
  }
  throw new Error('could not allocate order id');
}
