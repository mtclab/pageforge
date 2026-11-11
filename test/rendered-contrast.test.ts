import { describe, expect, it } from 'vitest';
import { THEMES } from '../src/themes/index.js';
import { contrastFailures, type Meta } from './helpers/contrast-matrix.js';

/**
 * #50 (and #49): palette tokens passing on bg and surface is not the same as
 * the page being readable. Text sits on section surfaces, accent tints, the
 * heading highlighter. This gate renders every theme x every built-in palette
 * x every section surface (and the highlighter), resolves the stylesheet, and
 * checks each piece of text against the background it actually sits on:
 * WCAG AA, 4.5:1 for body text, 3:1 for large text.
 */
const SURFACES: Meta['surface'][] = [undefined, 'card', 'tinted', 'bordered', 'flat'];

describe('rendered contrast: every theme x built-in palette x surface', () => {
  for (const theme of THEMES) {
    for (const palette of theme.palettes) {
      it(`${theme.id}/${palette.id}`, () => {
        const failures: string[] = [];
        for (const surface of SURFACES) {
          for (const headingStyle of [undefined, 'highlight'] as const) {
            if (headingStyle && surface && surface !== 'tinted') continue;
            const label = `surface=${surface ?? 'theme'} heading=${headingStyle ?? 'theme'}`;
            for (const f of contrastFailures(theme, { paletteId: palette.id, surface, headingStyle })) {
              failures.push(`${label}: ${f}`);
            }
          }
        }
        expect(failures).toEqual([]);
      });
    }
  }
});
