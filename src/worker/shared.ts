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

export interface Env {
  SITES: KVNamespace;
  ASSETS: AssetsFetcher;
  PUBLISH_ENABLED?: string;
  MUTATION_API_ENABLED?: string;
  OPERATOR_KEY?: string;
  BUILD_COMMIT?: string;
  BUILD_TIME?: string;
}

export const MAX_BODY = 6 * 1024 * 1024;
export const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

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

export async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
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
