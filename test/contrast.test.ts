import { describe, expect, it } from 'vitest';
import { THEMES } from '../src/themes/index.js';

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const chan = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * chan((n >> 16) & 0xff) +
    0.7152 * chan((n >> 8) & 0xff) +
    0.0722 * chan(n & 0xff)
  );
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

/**
 * WCAG AA guardrail for palette authoring:
 * body text on bg and surface >= 4.5, accent (link color) on bg >= 4.5,
 * accent-contrast on accent >= 4.5; accent and muted on bg and surface >= 4.5.
 */
describe('palette contrast (WCAG AA)', () => {
  for (const theme of THEMES) {
    for (const palette of theme.palettes) {
      const v = palette.vars;
      it(`${theme.id}/${palette.id}`, () => {
        expect(contrast(v.text, v.bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(v.text, v.surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(v.accent, v.bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(v.accent, v.surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(v['accent-contrast'], v.accent)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(v.muted, v.bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(v.muted, v.surface)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
