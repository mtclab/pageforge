import { describe, expect, it } from 'vitest';
import { QR_MAX_BYTES, qrSvg } from '../src/app/qr.js';

describe('qrSvg', () => {
  it('produces a scalable svg deterministically', () => {
    const a = qrSvg('https://pageforge.mtclab.net/');
    const b = qrSvg('https://pageforge.mtclab.net/');
    expect(a).toBe(b);
    expect(a).toMatch(/^<svg /);
    expect(a).toContain('viewBox');
  });
  it('different urls give different codes', () => {
    expect(qrSvg('https://a.example')).not.toBe(qrSvg('https://b.example'));
  });
  it('rejects addresses beyond the encoder byte limit without calling make', () => {
    expect(() => qrSvg('x'.repeat(QR_MAX_BYTES + 1))).toThrow('address too long');
  });
});
