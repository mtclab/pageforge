import { describe, expect, it } from 'vitest';
import { renderSite } from '../src/engine/render.js';
import type { SiteData } from '../src/engine/types.js';
import { THEMES } from '../src/themes/index.js';
import full from './fixtures/full.json';
import { loadPage, textSamples } from './helpers/rendered-style.js';

/**
 * #51: the Style step's text size (S/M/L) only reached the base type scale.
 * Themes set their headings, taglines, links and footers in fixed rem, so the
 * biggest type on the page did not move. Asserts the outcome: every piece of
 * text on every theme renders smaller at S and larger at L than at M.
 */
function sizes(themeId: string, textScale: 's' | 'm' | 'l'): { label: string; px: number }[] {
  const theme = THEMES.find((t) => t.id === themeId)!;
  const data = {
    ...(full as SiteData),
    meta: { themeId, paletteId: theme.defaults.paletteId, fontId: theme.defaults.fontId, textScale },
  } as SiteData;
  const { html, css } = renderSite(data, theme);
  return textSamples(loadPage(html, css)).map((s) => ({
    label: `${s.el.tagName.toLowerCase()}${s.el.className ? `.${s.el.className}` : ''} "${s.text}"`,
    px: s.px,
  }));
}

describe('text size option scales every piece of text', () => {
  for (const theme of THEMES) {
    it(theme.id, () => {
      const s = sizes(theme.id, 's');
      const m = sizes(theme.id, 'm');
      const l = sizes(theme.id, 'l');
      expect(s.length).toBe(m.length);
      expect(l.length).toBe(m.length);
      const unscaled = m
        .map((mid, i) => ({ mid, small: s[i]!, large: l[i]! }))
        .filter(({ mid, small, large }) => !(small.px < mid.px - 0.1 && large.px > mid.px + 0.1))
        .map(({ mid, small, large }) => `${mid.label}: S ${small.px.toFixed(1)} / M ${mid.px.toFixed(1)} / L ${large.px.toFixed(1)}`);
      expect(unscaled).toEqual([]);
      // the largest type on the page is a heading and it moves too
      const biggest = m.reduce((a, b) => (b.px > a.px ? b : a));
      expect(biggest.label).toMatch(/^h1/);
    });
  }
});
