import { esc, escAttr } from '../engine/escape.js';
import { ControlPlane } from './db.js';
import {
  MockProvider,
  paymentProvider,
  paymentStatusForEvent,
} from './payments.js';
import { type Env, JSON_HEADERS } from './shared.js';

const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex',
};

function page(title: string, content: string): Response {
  return new Response(`<!doctype html>
<html lang="fi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title></head>
<body><main><h1>${esc(title)}</h1>${content}</main></body>
</html>`, { headers: HTML_HEADERS });
}

async function mockCheckout(orderRef: string, env: Env): Promise<Response> {
  const cp = new ControlPlane(env.DB);
  const order = await cp.getOrderByPublicId(orderRef);
  if (!order || order.provider !== 'mock' || order.status !== 'luotu') {
    return new Response('Not found', { status: 404 });
  }
  const provider = paymentProvider(env);
  if (!(provider instanceof MockProvider)) return new Response('Not found', { status: 404 });
  const payBody = new URLSearchParams({
    type: 'checkout.session.completed',
    orderRef: order.publicId,
  }).toString();
  const cancelBody = new URLSearchParams({
    type: 'checkout.session.expired',
    orderRef: order.publicId,
  }).toString();
  const [paySignature, cancelSignature] = await Promise.all([
    provider.signature(payBody),
    provider.signature(cancelBody),
  ]);
  const form = (label: string, body: string, signature: string): string => {
    const fields = [...new URLSearchParams(body)].map(([name, value]) =>
      `<input type="hidden" name="${escAttr(name)}" value="${escAttr(value)}">`).join('');
    return `<form action="/api/billing/webhook?mock-signature=${escAttr(encodeURIComponent(signature))}" method="post">${fields}<button type="submit">${esc(label)}</button></form>`;
  };
  return page(
    'Testimaksu',
    `<p>Tämä on paikallinen testikassa. Maksua ei veloiteta.</p>${form('Maksa (testi)', payBody, paySignature)}${form('Peruuta', cancelBody, cancelSignature)}`,
  );
}

async function webhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const provider = paymentProvider(env);
  const event = await provider.parseWebhook(request);
  if (!event) return new Response(JSON.stringify({ error: 'Invalid signature.' }), {
    status: 400,
    headers: JSON_HEADERS,
  });
  const cp = new ControlPlane(env.DB);
  const order = event.orderRef ? await cp.getOrderByPublicId(event.orderRef) : null;
  const status = paymentStatusForEvent(event.type);
  await cp.recordBillingEvent({
    ...(order === null ? {} : { order }),
    type: event.type,
    payload: event.raw,
    ...(order && status ? { status } : {}),
    ...(event.providerSubId === undefined ? {} : { providerSubId: event.providerSubId }),
  });
  return new Response(JSON.stringify({ received: true }), { status: 200, headers: JSON_HEADERS });
}

export async function handleBillingRequest(request: Request, env: Env): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  if (pathname === '/api/billing/webhook') return webhook(request, env);
  const mockMatch = pathname.match(/^\/mock-checkout\/([a-z0-9]{8})$/);
  if (mockMatch) {
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
    return mockCheckout(mockMatch[1]!, env);
  }
  const resultMatch = pathname.match(/^\/order\/[a-z0-9]{8}\/(kiitos|peruttu)$/);
  if (resultMatch) {
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
    return resultMatch[1] === 'kiitos'
      ? page('Kiitos tilauksesta', '<p>Maksun tila päivittyy automaattisesti.</p>')
      : page('Tilaus peruutettu', '<p>Maksua ei suoritettu.</p>');
  }
  return new Response('Not found', { status: 404 });
}
