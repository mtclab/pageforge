import { describe, expect, it } from 'vitest';
import {
  checkCsrfToken,
  clearSessionCookie,
  makeCsrfToken,
  readSessionCookie,
  SESSION_TTL_SECONDS,
  setSessionCookie,
  signSessionCookie,
  verifySessionCookie,
} from '../src/worker/session.js';

describe('operator sessions', () => {
  const key = 'test-operator-key';
  const now = 1_720_000_000_000;

  it('signs and verifies a 12-hour stateless session', async () => {
    const session = await signSessionCookie(key, now);
    expect(session.expiry).toBe(Math.floor(now / 1000) + SESSION_TTL_SECONDS);
    expect(await verifySessionCookie(session.value, key, now)).toBe(session.expiry);
    expect(setSessionCookie(session.value, session.expiry)).toContain('HttpOnly; Secure; SameSite=Strict; Path=/admin');
  });

  it('rejects expired, malformed, tampered, and wrong-key sessions', async () => {
    const session = await signSessionCookie(key, now);
    expect(await verifySessionCookie(session.value, key, (session.expiry + 1) * 1000)).toBeNull();
    const tampered = `${session.value.slice(0, -1)}${session.value.endsWith('0') ? '1' : '0'}`;
    expect(await verifySessionCookie(tampered, key, now)).toBeNull();
    expect(await verifySessionCookie(session.value, 'rotated-key', now)).toBeNull();
    expect(await verifySessionCookie('not-a-session', key, now)).toBeNull();
  });

  it('makes session-bound CSRF tokens and compares them safely', async () => {
    const session = await signSessionCookie(key, now);
    const token = await makeCsrfToken(key, session.expiry);
    expect(await checkCsrfToken(token, key, session.expiry)).toBe(true);
    expect(await checkCsrfToken(`${token.slice(0, -1)}0`, key, session.expiry)).toBe(false);
    expect(await checkCsrfToken(token, 'rotated-key', session.expiry)).toBe(false);
    expect(await checkCsrfToken(undefined, key, session.expiry)).toBe(false);
  });

  it('reads only the named cookie and emits a complete clearing cookie', () => {
    const request = new Request('https://example.test/admin', {
      headers: { cookie: 'other=x; pf_admin=123.signature; final=y' },
    });
    expect(readSessionCookie(request)).toBe('123.signature');
    expect(clearSessionCookie()).toContain('Max-Age=0');
    expect(clearSessionCookie()).toContain('Path=/admin');
  });
});
