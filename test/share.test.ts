import { describe, expect, it } from 'vitest';
import { decodeShare, encodeShare } from '../src/app/share.js';
import type { SiteData } from '../src/engine/types.js';
import full from './fixtures/full.json';

describe('share links', () => {
  it('round-trips SiteData through the URL fragment', () => {
    const url = encodeShare(full as SiteData, 'https://pageforge.mtclab.net/');
    const hash = url.slice(url.indexOf('#'));
    const decoded = decodeShare(hash);
    expect(decoded).not.toBeNull();
    expect(decoded!.name).toBe('Anna Virtanen');
    expect(decoded!.sections.length).toBe((full as SiteData).sections.length);
  });

  it('strips the photo from the link', () => {
    const url = encodeShare(full as SiteData, 'x');
    const decoded = decodeShare(url.slice(url.indexOf('#')));
    expect(decoded!.photo).toBeUndefined();
  });

  it('keeps links reasonably short without photos', () => {
    const url = encodeShare(full as SiteData, '');
    expect(url.length).toBeLessThan(4000);
  });

  it('rejects garbage', () => {
    expect(decodeShare('#s=!!!')).toBeNull();
    expect(decodeShare('#s=aGVsbG8')).toBeNull();
    expect(decodeShare('#gallery')).toBeNull();
    expect(decodeShare('')).toBeNull();
  });
});
