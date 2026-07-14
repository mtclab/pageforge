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
    expect(contrast(m![1]!, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
  it('invalid custom accent falls back to the canonical palette accent', () => {
    const data = { ...base, meta: { ...base.meta, accent: 'red; } body { display: none' } } as SiteData;
    const { css } = renderSite(data, THEMES[0]!);
    expect(css).not.toContain('display: none');
    expect(css).toContain('--accent: #3b5bdb;');
  });
  it('surface/corners/shadow/density land as body class + vars (v2a)', () => {
    const data: SiteData = {
      ...base,
      meta: { ...base.meta, surface: 'card', corners: 'round', shadow: 'lifted', density: 'airy' },
    };
    const { html, css } = renderSite(data, THEMES[0]!);
    expect(html).toContain('surface-card');
    expect(css).toContain('--section-radius: 22px;');
    expect(css).toContain('--section-shadow: 0 10px 28px -10px');
    expect(css).toContain('--density: 1.35;');
  });
  it('no surface override -> no surface class (theme keeps its own look)', () => {
    const { html } = renderSite(base, THEMES[0]!);
    expect(html).not.toContain('surface-');
  });
  it('v2b/v2c flags land as body classes', () => {
    const data: SiteData = {
      ...base,
      photo: { dataUrl: 'data:image/jpeg;base64,AA==' },
      meta: {
        ...base.meta,
        headingStyle: 'highlight',
        heroAlign: 'center',
        photoSize: 'l',
        background: 'dots',
      },
    };
    const { html } = renderSite(data, THEMES[0]!);
    expect(html).toContain('heading-highlight');
    expect(html).toContain('hero-center');
    expect(html).toContain('photo-sz-l');
    expect(html).toContain('bg-dots');
  });
  it('auto dark emits a prefers-color-scheme block with the darkest palette', () => {
    const slateTheme = THEMES.find((t) => t.id === 'slate')!;
    const data: SiteData = { ...base, meta: { ...base.meta, autoDark: true } };
    const { css } = renderSite(data, slateTheme);
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain('--bg: #17191c'); // graphite
  });
  it('auto dark is a no-op when already on a dark palette', () => {
    const slateTheme = THEMES.find((t) => t.id === 'slate')!;
    const data: SiteData = {
      ...base,
      meta: { ...base.meta, paletteId: 'graphite', autoDark: true },
    };
    const { css } = renderSite(data, slateTheme);
    expect(css).not.toContain('prefers-color-scheme: dark');
  });
  it('custom accent inside auto dark is refit against the dark bg', () => {
    const slateTheme = THEMES.find((t) => t.id === 'slate')!;
    const data: SiteData = { ...base, meta: { ...base.meta, autoDark: true, accent: '#00337f' } };
    const { css } = renderSite(data, slateTheme);
    const m = css.match(/prefers-color-scheme: dark\) \{\n:root \{[\s\S]*?--accent: (#[0-9a-f]{6});/);
    expect(m).not.toBeNull();
    expect(contrast(m![1]!, '#17191c')).toBeGreaterThanOrEqual(4.5);
  });
  it('custom palette (designer) is contrast-guarded even with hostile picks', () => {
    const nasty = [
      { bg: '#ffffff', surface: '#ffffff', text: '#ffffff', muted: '#fefefe', accent: '#ffff00' },
      { bg: '#000000', surface: '#000000', text: '#010101', muted: '#111111', accent: '#000011' },
      { bg: '#7f7f7f', surface: '#808080', text: '#7f7f7f', muted: '#808080', accent: '#7f7f7f' },
    ];
    for (const cp of nasty) {
      const data: SiteData = { ...base, meta: { ...base.meta, customPalette: cp } };
      const { css } = renderSite(data, THEMES[0]!);
      const get = (v: string) => css.match(new RegExp(`--${v}: (#[0-9a-f]{6})`))![1]!;
      expect(contrast(get('text'), get('bg'))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(get('accent'), get('bg'))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(get('accent'), get('surface'))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(get('muted'), get('bg'))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(get('muted'), get('surface'))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(get('accent-contrast'), get('accent'))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(get('text'), get('surface'))).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('rejects a custom surface when no foreground can pass on both backgrounds', () => {
    const data: SiteData = {
      ...base,
      meta: {
        ...base.meta,
        customPalette: {
          bg: '#ffffff', surface: '#000000', text: '#777777', muted: '#888888', accent: '#777777',
        },
      },
    };
    const { css } = renderSite(data, THEMES[0]!);
    expect(css).toContain('--surface: #ffffff;');
  });
  it('invalid custom palette is ignored', () => {
    const data: SiteData = {
      ...base,
      meta: { ...base.meta, customPalette: { bg: 'red', surface: 'x', text: '', muted: '1', accent: 'javascript:' } },
    };
    const { css } = renderSite(data, THEMES[0]!);
    expect(css).toContain('--bg: #fafaf8;'); // slate paper stays
  });
  it('defaults resolve to the theme values', () => {
    const { css } = renderSite(base, THEMES[0]!);
    expect(css).toContain('--page-max: 42rem;');
    expect(css).toContain('--text-factor: 1;');
    expect(css).toContain('--photo-radius: 50%;');
  });
});
