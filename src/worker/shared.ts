import type { D1Database, Site } from './db.js';

export interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts?: { prefix?: string; cursor?: string; limit?: number }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

export interface AssetsFetcher {
  fetch(request: Request): Promise<Response>;
}

/**
 * Minimal R2 surface used by the photo store, kept local like the KV shim so
 * unit tests can supply an in-memory stub. Mirrors the Cloudflare R2 API we
 * actually call: put/get/head with httpMetadata.contentType.
 */
export interface R2HttpMetadata {
  contentType?: string;
}
export interface R2Object {
  httpMetadata?: R2HttpMetadata;
  size: number;
}
export interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  arrayBuffer(): Promise<ArrayBuffer>;
}
export interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  head(key: string): Promise<R2Object | null>;
  put(
    key: string,
    value: ArrayBuffer | Uint8Array,
    opts?: { httpMetadata?: R2HttpMetadata },
  ): Promise<R2Object>;
  delete(key: string | string[]): Promise<void>;
}

export interface Env {
  SITES: KVNamespace;
  ASSETS: AssetsFetcher;
  /** D1 control plane: source of truth for business sites (see db.ts). */
  DB: D1Database;
  /** R2 bucket for business photo bytes. */
  PHOTOS: R2Bucket;
  PUBLISH_ENABLED?: string;
  MUTATION_API_ENABLED?: string;
  BIZ_INDEXING_ENABLED?: string;
  OPERATOR_KEY?: string;
  PRICE_BUILD_CENTS?: string;
  PRICE_MONTHLY_CENTS?: string;
  VENDOR_MODE?: string;
  VERIFY_HTTP_ENABLED?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  BUILD_COMMIT?: string;
  BUILD_TIME?: string;
}

export const MAX_BODY = 6 * 1024 * 1024;
export const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
export const BIZ_RENDER_CACHE_PREFIX = 'bizhtml:';

const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const encoder = new TextEncoder();

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export async function readJson<T>(request: Request): Promise<{ value: T } | { error: Response }> {
  const length = Number(request.headers.get('content-length') ?? '0');
  if (length > MAX_BODY) return { error: json(413, { error: 'Request body is too large.' }) };
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { error: json(400, { error: 'Invalid request.' }) };
  }
  if (new TextEncoder().encode(text).length > MAX_BODY) {
    return { error: json(413, { error: 'Request body is too large.' }) };
  }
  try {
    return { value: JSON.parse(text) as T };
  } catch {
    return { error: json(400, { error: 'Invalid request.' }) };
  }
}

export function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(value: string | ArrayBuffer): Promise<string> {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value;
  return bytesToHex(await crypto.subtle.digest('SHA-256', bytes));
}

export async function hmacHex(secret: string | ArrayBuffer, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    typeof secret === 'string' ? encoder.encode(secret) : secret,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return bytesToHex(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

export function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((byte) => ID_ALPHABET[byte % ID_ALPHABET.length]).join('');
}

export async function unusedId(
  exists: (id: string) => Promise<unknown>,
  label: string,
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const id = randomId();
    if (!(await exists(id))) return id;
  }
  throw new Error(`could not allocate ${label} id`);
}

export function formString(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === 'string' ? value : undefined;
}

export function optionalFormString(form: FormData, name: string): string | undefined {
  const value = formString(form, name)?.trim();
  return value ? value : undefined;
}

export function bizRenderCachePrefix(sitePublicId: string): string {
  return `${BIZ_RENDER_CACHE_PREFIX}${sitePublicId}:`;
}

export function bizRenderCacheKey(site: Site, noindex: boolean): string {
  return `${bizRenderCachePrefix(site.publicId)}${site.currentVersion}:${site.publishedVersion ?? 'live'}:${noindex ? 'noindex' : 'index'}`;
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let different = 0;
  for (let i = 0; i < a.length; i++) different |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return different === 0;
}

export function bearerToken(request: Request): string | null {
  const match = request.headers.get('authorization')?.match(/^Bearer (.+)$/);
  return match?.[1] ?? null;
}

export async function secretMatches(token: string, expectedHash: string): Promise<boolean> {
  return constantTimeEqual(await sha256Hex(token), expectedHash);
}

export async function requireOperator(request: Request, env: Env): Promise<Response | null> {
  const token = bearerToken(request);
  if (!token) return json(401, { error: 'Authorization required.' });
  if (!env.OPERATOR_KEY || !(await secretMatches(token, await sha256Hex(env.OPERATOR_KEY)))) {
    return json(403, { error: 'Forbidden.' });
  }
  return null;
}
