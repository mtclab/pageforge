import { ControlPlane, type Site, type UpdateRequest } from './db.js';
import { type Env, json, readJson, requireOperator } from './shared.js';

export const MAX_EMAIL_BYTES = 64 * 1024;

export interface EmailMessage {
  from: string;
  to: string;
  raw: ReadableStream<Uint8Array>;
  headers: Headers;
}

export interface EmailIngress {
  from: string;
  to: string;
  subject?: string;
  body: string;
}

function emailAddress(value: string): string {
  const bracketed = value.match(/<([^<>]+)>/);
  return (bracketed?.[1] ?? value).trim().toLowerCase();
}

export function capUtf8(value: string, maxBytes = MAX_EMAIL_BYTES): string {
  const bytes = new TextEncoder().encode(value);
  if (bytes.byteLength <= maxBytes) return value;
  return new TextDecoder().decode(bytes.slice(0, maxBytes));
}

export async function readCappedEmailRaw(
  stream: ReadableStream<Uint8Array>,
  maxBytes = MAX_EMAIL_BYTES,
): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value?.byteLength) continue;
    const room = maxBytes - size;
    const chunk = value.byteLength > room ? value.slice(0, room) : value;
    chunks.push(chunk);
    size += chunk.byteLength;
    if (value.byteLength > room) {
      await reader.cancel();
      break;
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function matchedSite(cp: ControlPlane, from: string, to: string): Promise<Site | null> {
  const recipient = emailAddress(to);
  const plus = recipient.match(/^paivita\+([^@]+)@/i);
  if (plus) {
    const byRecipient = await cp.getSiteByPublicId(plus[1]!.toLowerCase());
    if (byRecipient) return byRecipient;
  }
  return cp.findSiteByContactEmail(emailAddress(from));
}

/** Shared by the production Email Worker handler and the staging simulator. */
export async function ingestEmail(
  env: Env,
  input: EmailIngress,
): Promise<UpdateRequest | null> {
  const cp = new ControlPlane(env.DB);
  const site = await matchedSite(cp, input.from, input.to);
  if (!site) {
    await cp.recordAudit({
      actor: 'system',
      action: 'email.unmatched',
      entity: 'email',
      entityId: emailAddress(input.to) || 'unknown',
      detail: { from: emailAddress(input.from), to: emailAddress(input.to) },
    });
    return null;
  }
  return cp.createUpdateRequest({
    site,
    channel: 'email',
    fromAddr: emailAddress(input.from),
    ...(input.subject === undefined ? {} : { subject: input.subject }),
    body: capUtf8(input.body),
    actor: 'system',
  });
}

export async function handleEmailMessage(message: EmailMessage, env: Env): Promise<void> {
  await ingestEmail(env, {
    from: message.from,
    to: message.to,
    subject: message.headers.get('subject') ?? undefined,
    body: await readCappedEmailRaw(message.raw),
  });
}

export async function handleEmailSimulator(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });
  const denied = await requireOperator(request, env);
  if (denied) return denied;
  const parsed = await readJson<{ from?: unknown; to?: unknown; subject?: unknown; text?: unknown }>(request);
  if ('error' in parsed) return parsed.error;
  const { from, to, subject, text } = parsed.value;
  if (
    typeof from !== 'string'
    || typeof to !== 'string'
    || typeof text !== 'string'
    || (subject !== undefined && typeof subject !== 'string')
  ) {
    return json(400, { error: 'from, to, and text are required strings.' });
  }
  const created = await ingestEmail(env, {
    from,
    to,
    ...(subject === undefined ? {} : { subject }),
    body: text,
  });
  return json(200, {
    ok: true,
    matched: created !== null,
    ...(created === null ? {} : { updateRequestId: created.id }),
  });
}
