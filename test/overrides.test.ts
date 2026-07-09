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

describe('style overrides', () => {
  it('photo shape override lands in the body class', () => {
    const data: SiteData = {
      ...base,
      photo: { dataUrl: 'data:image/jpeg;base64,AA==' },
      meta: { ...base.meta, photoShape: 'square' },
    };
    expect(renderSite(data, THEMES[0]!).html).toContain('photo-square');
  });
  it('width + text overrides land in the css after theme css', () => {
    const data: SiteData = { ...base, meta: { ...base.meta, width: 'wide', textScale: 'l' } };
    const { css } = renderSite(data, THEMES[0]!);
    expect(css).toContain('max-width: 54rem');
    expect(css).toContain('* 1.12');
    expect(css.indexOf('your style choices')).toBeGreaterThan(css.indexOf('theme: slate'));
  });
  it('custom accent is fitted and re-declared last', () => {
    const data: SiteData = { ...base, meta: { ...base.meta, accent: '#ffff00' } };
    const { css } = renderSite(data, THEMES[0]!);
    const m = css.match(/your style choices \*\/\n:root \{ --accent: (#[0-9a-f]{6});/);
    expect(m).not.toBeNull();
    expect(contrast(m![1]!, '#fafaf8')).toBeGreaterThanOrEqual(4.5);
  });
  it('no overrides -> no override block (snapshots stay stable)', () => {
    const { css } = renderSite(base, THEMES[0]!);
    expect(css).not.toContain('your style choices');
  });
});
