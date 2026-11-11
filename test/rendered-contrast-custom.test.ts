import { describe, expect, it } from 'vitest';
import { THEMES } from '../src/themes/index.js';
import { contrastFailures } from './helpers/contrast-matrix.js';

/**
 * The same rendered-contrast gate for the colours users pick themselves.
 *
 * #50: a custom accent was fitted against bg and surface only, so on a tinted
 * section (color-mix(accent 7%, bg)) links and headings dropped below 4.5:1
 * (e.g. linen/clay + #ffff00 -> #737300 on #f1ecde = 4.26).
 * #49: theme CSS painted sections with literal white, so a dark custom palette
 * put near-white text on a white card (1.16:1 in scrapbook).
 */
const ACCENTS = ['#ffff00', '#000000', '#ffffff', '#ff0000'];

const CUSTOM_PALETTES = {
  dark: { bg: '#111111', surface: '#1c1c1c', text: '#eeeeee', muted: '#aaaaaa', accent: '#ff9900' },
  light: { bg: '#ffffff', surface: '#f2f2f2', text: '#222222', muted: '#555555', accent: '#0055aa' },
  warm: { bg: '#2a1d14', surface: '#3a2a1e', text: '#f4e9dc', muted: '#cdb8a0', accent: '#e0a060' },
};

describe('rendered contrast: custom accents on every built-in palette', () => {
  for (const theme of THEMES) {
    for (const palette of theme.palettes) {
      it(`${theme.id}/${palette.id}`, () => {
        const failures: string[] = [];
        for (const accent of ACCENTS) {
          for (const surface of [undefined, 'tinted'] as const) {
            for (const f of contrastFailures(theme, { paletteId: palette.id, accent, surface })) {
              failures.push(`accent=${accent} surface=${surface ?? 'theme'}: ${f}`);
            }
          }
        }
        expect(failures).toEqual([]);
      });
    }
  }
});

describe('rendered contrast: custom palettes on every theme', () => {
  for (const theme of THEMES) {
    it(theme.id, () => {
      const failures: string[] = [];
      for (const [name, customPalette] of Object.entries(CUSTOM_PALETTES)) {
        for (const surface of [undefined, 'card', 'tinted'] as const) {
          for (const f of contrastFailures(theme, { customPalette, surface })) {
            failures.push(`palette=${name} surface=${surface ?? 'theme'}: ${f}`);
          }
        }
      }
      expect(failures).toEqual([]);
    });
  }
});
