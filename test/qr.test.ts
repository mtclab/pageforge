import { describe, expect, it } from 'vitest';
import { qrSvg } from '../src/app/qr.js';

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
});
