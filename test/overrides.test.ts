import { describe, expect, it } from 'vitest';
import { accentContrastFor, contrast, fitAccent } from '../src/engine/color.js';
import { renderSite } from '../src/engine/render.js';
import type { SiteData } from '../src/engine/types.js';
import { THEMES } from '../src/themes/index.js';
import minimal from './fixtures/minimal.json';

const base = minimal as SiteData;

describe('fitAccent', () => {
  const bgs = ['#fafaf8', '#17191c', '#eef6e8', '#111111', '#faf5ef'];
  const picks = ['#ffff00', '#000000', '#ffffff', '#ff0000', '#7f7f7f', '#3b5bdb'];
  it('always lands at >= 4.5 contrast against any bg', () => {
    for (const bg of bgs) {
      for (const pick of picks) {
        const fitted = fitAccent(pick, bg);
        expect(contrast(fitted, bg), `${pick} on ${bg} -> ${fitted}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it('keeps already-passing colors untouched', () => {
    expect(fitAccent('#3b5bdb', '#fafaf8')).toBe('#3b5bdb');
  });
  it('accent-contrast always reads on the accent', () => {
    for (const pick of picks) {
      expect(contrast(accentContrastFor(pick), pick)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('is deterministic', () => {
    expect(fitAccent('#ffff00', '#fafaf8')).toBe(fitAccent('#ffff00', '#fafaf8'));
  });
});

/**
 * Themes must not hardcode values the override system owns (issue #4).
 * .page max-width must be a var or none; photo rules must not set
 * border-radius; body font-size stays base-owned.
 */
describe('theme css lint: no hardcoded override-owned values', () => {
  for (const theme of THEMES) {
    it(theme.id, () => {
      const pageBlocks = [...theme.css.matchAll(/\.page[^{]*\{[^}]*\}/gs)].map((m) => m[0]);
      for (const block of pageBlocks) {
        const mw = block.match(/max-width:\s*([^;]+);/);
        if (mw) expect(mw[1]!.trim(), `${theme.id} .page max-width`).toMatch(/^(none|var\(--page-max\))$/);
      }
      const photoBlocks = [...theme.css.matchAll(/\.photo[^{]*\{[^}]*\}/gs)].map((m) => m[0]);
      for (const block of photoBlocks) {
        expect(block, `${theme.id} photo block`).not.toContain('border-radius');
      }
      expect(theme.css, `${theme.id} body font-size`).not.toMatch(/body\s*\{[^}]*font-size/s);
      expect(parseFloat(theme.pageMax), `${theme.id} pageMax`).toBeGreaterThan(20);
    });
  }
});

describe('style overrides', () => {
  it('photo shape override lands in the body class', () => {
    const data: SiteData = {
      ...base,
      photo: { dataUrl: 'data:image/jpeg;base64,AA==' },
      meta: { ...base.meta, photoShape: 'square' },
    };
    expect(renderSite(data, THEMES[0]!).html).toContain('photo-square');
  });
  it('width + text overrides resolve into :root vars for EVERY theme', () => {
    for (const theme of THEMES) {
      const data: SiteData = {
        ...base,
        meta: { themeId: theme.id, paletteId: theme.defaults.paletteId, fontId: theme.defaults.fontId, width: 'wide', textScale: 'l' },
      };
      const { css } = renderSite(data, theme);
      const expected = `${Number((parseFloat(theme.pageMax) * 1.25).toFixed(2))}rem`;
      expect(css, theme.id).toContain(`--page-max: ${expected};`);
      expect(css, theme.id).toContain('--text-factor: 1.12;');
    }
  });
  it('photo radius override resolves for EVERY theme', () => {
    for (const theme of THEMES) {
      const data: SiteData = {
        ...base,
        photo: { dataUrl: 'data:image/jpeg;base64,AA==' },
        meta: { themeId: theme.id, paletteId: theme.defaults.paletteId, fontId: theme.defaults.fontId, photoShape: 'square' },
      };
      const { css } = renderSite(data, theme);
      expect(css, theme.id).toContain('--photo-radius: 0;');
    }
  });
  it('custom accent is fitted into the :root vars', () => {
    const data: SiteData = { ...base, meta: { ...base.meta, accent: '#ffff00' } };
    const { css } = renderSite(data, THEMES[0]!);
    const m = css.match(/--accent: (#[0-9a-f]{6});/);
    expect(m).not.toBeNull();
    expect(contrast(m![1]!, '#fafaf8')).toBeGreaterThanOrEqual(4.5);
  });
  it('defaults resolve to the theme values', () => {
    const { css } = renderSite(base, THEMES[0]!);
    expect(css).toContain('--page-max: 42rem;');
    expect(css).toContain('--text-factor: 1;');
    expect(css).toContain('--photo-radius: 50%;');
  });
});
