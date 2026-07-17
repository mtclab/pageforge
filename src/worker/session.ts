import { constantTimeEqual } from './shared.js';

export const ADMIN_COOKIE = 'pf_admin';
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

const encoder = new TextEncoder();

async function sessionKey(operatorKey: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', encoder.encode(operatorKey));
}

async function hmacHex(operatorKey: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    await sessionKey(operatorKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Stateless sessions are deliberately keyed only by OPERATOR_KEY: rotating the
 * operator key immediately revokes every existing console session.
 */
export async function signSessionCookie(
  operatorKey: string,
  now = Date.now(),
): Promise<{ value: string; expiry: number }> {
  const expiry = Math.floor(now / 1000) + SESSION_TTL_SECONDS;
  const signature = await hmacHex(operatorKey, String(expiry));
  return { value: `${expiry}.${signature}`, expiry };
}

/** Return the signed expiry epoch (seconds), or null for malformed/expired/tampered values. */
export async function verifySessionCookie(
  value: string | null | undefined,
  operatorKey: string,
  now = Date.now(),
): Promise<number | null> {
  if (!value) return null;
  const match = value.match(/^(\d{1,12})\.([a-f0-9]{64})$/);
  if (!match) return null;
  const expiry = Number(match[1]);
  if (!Number.isSafeInteger(expiry) || expiry <= Math.floor(now / 1000)) return null;
  const expected = await hmacHex(operatorKey, String(expiry));
  return constantTimeEqual(match[2]!, expected) ? expiry : null;
}

export function readSessionCookie(request: Request): string | null {
  const cookie = request.headers.get('cookie');
  if (!cookie) return null;
  for (const part of cookie.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === ADMIN_COOKIE) {
      return part.slice(separator + 1).trim();
    }
  }
  return null;
}

export function setSessionCookie(value: string, expiry: number): string {
  return `${ADMIN_COOKIE}=${value}; Expires=${new Date(expiry * 1000).toUTCString()}; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Strict; Path=/`;
}

export function clearSessionCookie(): string {
  return `${ADMIN_COOKIE}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; Secure; SameSite=Strict; Path=/`;
}

/** CSRF is bound to the signed session's expiry-hour bucket and the same rotated key. */
export async function makeCsrfToken(operatorKey: string, sessionExpiry: number): Promise<string> {
  return hmacHex(operatorKey, `csrf:${Math.floor(sessionExpiry / 3600)}`);
}

export async function checkCsrfToken(
  token: string | null | undefined,
  operatorKey: string,
  sessionExpiry: number,
): Promise<boolean> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const expected = await makeCsrfToken(operatorKey, sessionExpiry);
  return constantTimeEqual(token, expected);
}
