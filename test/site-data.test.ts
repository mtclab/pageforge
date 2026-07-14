import { describe, expect, it } from 'vitest';
import { decodeSiteData, decodeSiteMeta, replaceSiteData } from '../src/app/site-data.js';
import type { SiteData } from '../src/engine/types.js';
import full from './fixtures/full.json';
import hostileImage from './fixtures/hostile-image.json';
import hostileLook from './fixtures/hostile-look.json';
import minimal from './fixtures/minimal.json';

describe('SiteData runtime decoder', () => {
  it('defaults absent arrays and meta but rejects malformed arrays', () => {
    const decoded = decodeSiteData({ version: 1, name: 'Legacy' });
    expect(decoded?.links).toEqual([]);
    expect(decoded?.sections).toEqual([]);
    expect(decoded?.meta.themeId).toBe('slate');
    expect(decodeSiteData({ ...minimal, links: null })).toBeNull();
    expect(decodeSiteData({ ...minimal, links: {} })).toBeNull();
  });

  it('validates nested section items', () => {
    expect(decodeSiteData({ ...minimal, sections: [{ kind: 'projects', items: {} }] })).toBeNull();
    expect(decodeSiteData({ ...minimal, sections: [{ kind: 'hobbies', items: [1] }] })).toBeNull();
    expect(decodeSiteData({ ...minimal, sections: [{ kind: 'gallery', photos: [{}] }] })).toBeNull();
  });

  it('accepts a complete export as a detached clone', () => {
    const decoded = decodeSiteData(full);
    expect(decoded).toEqual(full);
    expect(decoded).not.toBe(full);
    expect(decoded?.sections).not.toBe((full as SiteData).sections);
  });

  it('rejects hostile or oversized imported image data URLs', () => {
    expect(decodeSiteData(hostileImage)).toBeNull();
    const tooLarge = `data:image/jpeg;base64,/9j/${'A'.repeat(1_100_001)}`;
    expect(decodeSiteData({ ...minimal, photo: { dataUrl: tooLarge } })).toBeNull();
  });

  it('rejects a hostile imported look before it reaches CSS', () => {
    expect(decodeSiteMeta(hostileLook.meta)).toBeNull();
  });

  it('full replacement preserves lang/favicon and clears absent optionals', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    const target = { ...(minimal as SiteData), lang: 'fi', favicon: { dataUrl: png }, tagline: 'old' };
    const imported = decodeSiteData({ ...minimal, lang: 'sv', favicon: { dataUrl: png } })!;
    replaceSiteData(target, imported);
    expect(target.lang).toBe('sv');
    expect(target.favicon).toEqual({ dataUrl: png });
    expect(target.tagline).toBeUndefined();
  });
});
