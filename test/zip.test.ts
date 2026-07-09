import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildSiteFiles, buildZip, slugify, zipFilename } from '../src/engine/bundle.js';
import type { SiteData } from '../src/engine/types.js';
import { THEMES } from '../src/themes/index.js';
import full from './fixtures/full.json';
import minimal from './fixtures/minimal.json';

const theme = THEMES[0]!;

describe('buildSiteFiles / buildZip', () => {
  it('zip contains the expected file set (with photo)', () => {
    const files = unzipSync(buildZip(buildSiteFiles(full as SiteData, theme)));
    expect(Object.keys(files).sort()).toEqual([
      'README.md',
      'assets/favicon.svg',
      'assets/gallery-6-1.jpg',
      'assets/gallery-6-2.jpg',
      'assets/photo.jpg',
      'index.html',
      'site.json',
      'style.css',
    ]);
  });

  it('photo omitted when not provided', () => {
    const files = unzipSync(buildZip(buildSiteFiles(minimal as SiteData, theme)));
    expect(Object.keys(files)).not.toContain('assets/photo.jpg');
  });

  it('index.html is a complete page linking the stylesheet', () => {
    const files = buildSiteFiles(full as SiteData, theme);
    const html = strFromU8(files['index.html']!);
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('<title>Anna Virtanen</title>');
    expect(html).toContain('<link rel="stylesheet" href="style.css">');
    expect(html).toContain('assets/favicon.svg');
  });

  it('README covers the deploy paths', () => {
    const files = buildSiteFiles(full as SiteData, theme);
    const readme = strFromU8(files['README.md']!);
    expect(readme).toContain('https://app.netlify.com/drop');
    expect(readme).toContain('pages.github.com');
    expect(readme).toContain('neocities.org');
    expect(readme).toContain('developers.cloudflare.com/pages');
    expect(readme).toContain('public_html');
    expect(readme).toContain('site.json');
  });

  it('site.json round-trips the input data', () => {
    const files = buildSiteFiles(full as SiteData, theme);
    expect(JSON.parse(strFromU8(files['site.json']!))).toEqual(full);
  });

  it('zip is byte-identical across builds (determinism)', () => {
    const a = buildZip(buildSiteFiles(full as SiteData, theme));
    const b = buildZip(buildSiteFiles(full as SiteData, theme));
    expect(a.length).toBe(b.length);
    expect(a.every((byte, i) => byte === b[i])).toBe(true);
  });
});

describe('slugify / zipFilename', () => {
  it('slugs names', () => {
    expect(slugify('Anna Virtanen')).toBe('anna-virtanen');
    expect(slugify('Äiti Öölander!')).toBe('aiti-oolander');
    expect(zipFilename('Anna Virtanen')).toBe('anna-virtanen-homepage.zip');
  });
  it('falls back for unslugabble names', () => {
    expect(zipFilename('域名')).toBe('my-homepage.zip');
  });
});
