import { describe, expect, it } from 'vitest';
import { renderSite } from '../src/engine/render.js';
import type { SiteData } from '../src/engine/types.js';
import { THEMES } from '../src/themes/index.js';
import full from './fixtures/full.json';
import hostile from './fixtures/hostile.json';
import minimal from './fixtures/minimal.json';

const FIXTURES: Record<string, SiteData> = {
  minimal: minimal as SiteData,
  full: full as SiteData,
  hostile: hostile as SiteData,
};

describe('renderSite', () => {
  for (const theme of THEMES) {
    for (const [name, data] of Object.entries(FIXTURES)) {
      it(`snapshot: ${theme.id} x ${name}`, () => {
        const { html, css } = renderSite({ ...data, meta: { ...data.meta, themeId: theme.id } }, theme);
        expect(html).toMatchSnapshot('html');
        expect(css).toMatchSnapshot('css');
      });
    }
  }

  it('is deterministic (byte-identical on repeat renders)', () => {
    const a = renderSite(FIXTURES.full!, THEMES[0]!);
    const b = renderSite(FIXTURES.full!, THEMES[0]!);
    expect(a.html).toBe(b.html);
    expect(a.css).toBe(b.css);
  });

  it('hostile input produces no script tags or javascript: URLs', () => {
    for (const theme of THEMES) {
      const { html } = renderSite(FIXTURES.hostile!, theme);
      // No live markup survives escaping.
      expect(html.toLowerCase()).not.toContain('<script');
      expect(html.toLowerCase()).not.toContain('<img src=x');
      expect(html.toLowerCase()).not.toContain('<svg onload');
      // Every emitted href uses an allowed scheme (hostile schemes render as plain text).
      const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]!);
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) {
        expect(href).toMatch(/^(https?:|mailto:|style\.css$|assets\/)/);
      }
    }
  });

  it('empty sections are not rendered', () => {
    const data: SiteData = {
      ...FIXTURES.minimal!,
      sections: [
        { kind: 'about', text: '   ' },
        { kind: 'projects', items: [{ name: '' }] },
        { kind: 'hobbies', items: [' '] },
        { kind: 'contact' },
        { kind: 'custom', title: 'T', text: '' },
      ],
    };
    const { html } = renderSite(data, THEMES[0]!);
    expect(html).not.toContain('<section');
  });

  it('photo only renders when provided', () => {
    const without = renderSite(FIXTURES.minimal!, THEMES[0]!);
    expect(without.html).not.toContain('assets/photo.jpg');
    const withPhoto = renderSite(
      { ...FIXTURES.minimal!, photo: { dataUrl: 'data:image/jpeg;base64,AA==' } },
      THEMES[0]!,
    );
    expect(withPhoto.html).toContain('assets/photo.jpg');
  });
});
