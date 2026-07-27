import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  buildDownloadFiles,
  buildSiteFiles,
  buildZip,
  slugify,
  zipFilename,
} from '../src/engine/bundle.js';
import { SITE_DIR, type SiteData } from '../src/engine/types.js';
import { THEMES } from '../src/themes/index.js';
import full from './fixtures/full.json';
import minimal from './fixtures/minimal.json';

const theme = THEMES[0]!;
/** The address in fixtures/full.json - the one the page obfuscates. */
const EMAIL = 'anna@example.com';

describe('buildSiteFiles / buildZip', () => {
  it('zip contains the expected file set (with photo)', () => {
    const files = unzipSync(buildZip(buildDownloadFiles(full as SiteData, theme)));
    expect(Object.keys(files).sort()).toEqual([
      'README.md',
      'site.json',
      `${SITE_DIR}/assets/favicon.svg`,
      `${SITE_DIR}/assets/gallery-6-1.jpg`,
      `${SITE_DIR}/assets/gallery-6-2.jpg`,
      `${SITE_DIR}/assets/photo.jpg`,
      `${SITE_DIR}/index.html`,
      `${SITE_DIR}/style.css`,
    ]);
  });

  it('custom favicon replaces the generated one in zip and html', () => {
    const data: SiteData = {
      ...(minimal as SiteData),
      favicon: { dataUrl: 'data:image/png;base64,iVBORw0KGgo=' },
    };
    const files = buildSiteFiles(data, theme);
    expect(Object.keys(files)).toContain('assets/favicon.png');
    expect(Object.keys(files)).not.toContain('assets/favicon.svg');
    expect(strFromU8(files['index.html']!)).toContain('assets/favicon.png');
  });

  it('photo omitted when not provided', () => {
    const files = unzipSync(buildZip(buildDownloadFiles(minimal as SiteData, theme)));
    expect(Object.keys(files)).not.toContain(`${SITE_DIR}/assets/photo.jpg`);
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
    const files = buildDownloadFiles(full as SiteData, theme);
    const readme = strFromU8(files['README.md']!);
    expect(readme).toContain('https://app.netlify.com/drop');
    expect(readme).toContain('pages.github.com');
    expect(readme).toContain('neocities.org');
    expect(readme).toContain('developers.cloudflare.com/pages');
    expect(readme).toContain('public_html');
    expect(readme).toContain('site.json');
  });

  it('site.json round-trips the input data', () => {
    const files = buildDownloadFiles(full as SiteData, theme);
    expect(JSON.parse(strFromU8(files['site.json']!))).toEqual(full);
  });

  it('zip is byte-identical across builds (determinism)', () => {
    const a = buildZip(buildDownloadFiles(full as SiteData, theme));
    const b = buildZip(buildDownloadFiles(full as SiteData, theme));
    expect(a.length).toBe(b.length);
    expect(a.every((byte, i) => byte === b[i])).toBe(true);
  });
});

/**
 * The publishable-set gate.
 *
 * index.html hides the author's address from harvesters on purpose: there is a
 * feature for it, a test for it, and an activation script that assembles the
 * mailto only on click. That was undone one file over - site.json sat in the
 * same folder as index.html holding `"email": "anna@example.com"` in plain
 * text, and the README told the reader that folder IS their website and to
 * drag it onto Netlify Drop. Following our own instructions published the
 * address at theirsite.com/site.json, beside the draft and the photo.
 *
 * So: nothing we tell people to upload may contain the raw address, and the
 * file that does must sit outside the folder we tell them to upload. Put
 * site.json back into the site folder and these fail.
 */
describe('the publishable set', () => {
  const withEmail = full as SiteData;

  it('the fixture really does carry an email address (else this proves nothing)', () => {
    expect(JSON.stringify(withEmail)).toContain(EMAIL);
  });

  it('no file the user is told to upload contains the raw address', () => {
    for (const each of THEMES) {
      for (const [path, bytes] of Object.entries(buildSiteFiles(withEmail, each))) {
        expect(strFromU8(bytes), `${each.id}: ${path}`).not.toContain(EMAIL);
      }
    }
  });

  it('the zip keeps the draft outside the folder that goes online', () => {
    const files = unzipSync(buildZip(buildDownloadFiles(withEmail, theme)));
    const served = Object.entries(files).filter(([path]) => path.startsWith(`${SITE_DIR}/`));
    const kept = Object.keys(files).filter((path) => !path.startsWith(`${SITE_DIR}/`));

    expect(served.length).toBeGreaterThan(0);
    expect(kept.sort()).toEqual(['README.md', 'site.json']);
    for (const [path, bytes] of served) {
      expect(strFromU8(bytes), path).not.toContain(EMAIL);
    }
    // The draft is still there and still complete - this is a move, not a loss.
    expect(strFromU8(files['site.json']!)).toContain(EMAIL);
    expect(files[`${SITE_DIR}/index.html`]).toBeDefined();
  });

  it('the README names the folder to upload and warns about the draft', () => {
    const readme = strFromU8(buildDownloadFiles(withEmail, theme)['README.md']!);
    expect(readme).toContain(`drag the \`${SITE_DIR}\` folder onto https://app.netlify.com/drop`);
    expect(readme).toContain(`Upload only what is inside \`${SITE_DIR}\``);
    expect(readme).toMatch(/do NOT upload it/i);
    // "This folder IS your website" printed beside site.json is exactly what
    // made the leak follow from doing as we said.
    expect(readme).not.toContain('This folder IS your website');
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
