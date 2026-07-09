import type { ThemePack } from '../../engine/types.js';

/*
 * slate - minimal and calm. Centered column, generous whitespace,
 * thin rules, small-caps section headings.
 */

const css = `/* theme: slate */
.page {
  max-width: 42rem;
  margin: 0 auto;
  padding: clamp(2rem, 5vw, 4rem) 1.25rem 3rem;
}
.hero { text-align: center; padding-bottom: 2.5rem; border-bottom: 1px solid color-mix(in srgb, var(--muted) 35%, transparent); }
.hero .photo { width: 128px; height: 128px; margin: 0 auto 1.25rem; }
.hero h1 { letter-spacing: -0.01em; }
.tagline { margin-top: 0.5rem; }
.hero .links { justify-content: center; margin-top: 1.5rem; }
.section h2 {
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}
.section { border-bottom: 1px solid color-mix(in srgb, var(--muted) 35%, transparent); padding-bottom: 2.5rem; }
.section:last-child { border-bottom: none; }
.chips li { border-color: color-mix(in srgb, var(--muted) 45%, transparent); }
footer { text-align: center; }
`;

export const slate: ThemePack = {
  id: 'slate',
  name: 'Slate',
  tagline: 'Minimal and calm',
  layout: 'centered-column',
  photoShape: 'circle',
  fonts: [
    {
      id: 'system',
      name: 'Clean',
      stack: "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    },
    {
      id: 'serif',
      name: 'Classic',
      stack: "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      headingStack: "Georgia, 'Times New Roman', serif",
    },
  ],
  palettes: [
    {
      id: 'paper',
      name: 'Paper',
      vars: {
        bg: '#fafaf8',
        surface: '#ffffff',
        text: '#26282b',
        muted: '#5f646b',
        accent: '#3b5bdb',
        'accent-contrast': '#ffffff',
      },
    },
    {
      id: 'graphite',
      name: 'Graphite',
      vars: {
        bg: '#17191c',
        surface: '#212429',
        text: '#e8eaed',
        muted: '#9aa0a8',
        accent: '#8ab4f8',
        'accent-contrast': '#0d1117',
      },
    },
    {
      id: 'sage',
      name: 'Sage',
      vars: {
        bg: '#f4f7f2',
        surface: '#ffffff',
        text: '#2a3129',
        muted: '#5e675c',
        accent: '#3d6b35',
        'accent-contrast': '#ffffff',
      },
    },
  ],
  css,
  defaults: { paletteId: 'paper', fontId: 'system' },
};
