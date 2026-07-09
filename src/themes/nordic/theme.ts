import type { ThemePack } from '../../engine/types.js';

/*
 * nordic - calm and warm. Hygge minimalism: wood, wool, snow. An airy
 * centered column where nothing shouts - thin accents, quiet footer,
 * a small round photo floating in generous space.
 */

const css = `/* theme: nordic */
.page {
  margin: 0 auto;
  padding: clamp(2.5rem, 6vw, 4rem) 1.5rem 3.5rem;
  line-height: 1.75;
}
.hero { padding-bottom: 1.5rem; }
.hero .photo {
  width: 96px;
  height: 96px;
  margin: 0 0 2rem;
}
.hero h1 { font-weight: 600; letter-spacing: 0.01em; }
.tagline { margin-top: 0.6rem; }
.hero .links { margin-top: 1.75rem; }
.links a { text-decoration: underline; text-underline-offset: 4px; text-decoration-color: color-mix(in srgb, var(--accent) 50%, transparent); }
.section {
  border-left: 2px solid color-mix(in srgb, var(--accent) 45%, transparent);
  padding-left: 1.4rem;
}
.section h2 { font-weight: 600; color: var(--accent); }
.project h3 { font-size: 1.05rem; font-weight: 600; }
.chips { display: block; }
.chips li { display: inline; background: none; border: none; border-radius: 0; padding: 0; }
.chips li + li::before { content: '\\00b7 '; color: var(--muted); }
footer { font-size: 0.8125rem; opacity: 0.75; }
`;

export const nordic: ThemePack = {
  id: 'nordic',
  name: 'Nordic',
  tagline: 'Calm and warm',
  layout: 'centered-column',
  photoShape: 'circle',
  pageMax: '40rem',
  fonts: [
    {
      id: 'soft',
      name: 'Soft',
      stack: "'Segoe UI', system-ui, sans-serif",
      headingStack: "'Segoe UI', system-ui, sans-serif",
    },
    {
      id: 'bookish',
      name: 'Bookish',
      stack: "Georgia, 'Times New Roman', serif",
      headingStack: "Georgia, 'Times New Roman', serif",
    },
  ],
  palettes: [
    {
      id: 'birch',
      name: 'Birch',
      vars: {
        bg: '#fcfbf8',
        surface: '#ffffff',
        text: '#26292b',
        muted: '#5c6469',
        accent: '#3d5a6b',
        'accent-contrast': '#ffffff',
      },
    },
    {
      id: 'juniper',
      name: 'Juniper',
      vars: {
        bg: '#f2f5f2',
        surface: '#ffffff',
        text: '#212a26',
        muted: '#556059',
        accent: '#2b5741',
        'accent-contrast': '#ffffff',
      },
    },
    {
      id: 'fjord-night',
      name: 'Fjord Night',
      vars: {
        bg: '#232b31',
        surface: '#2c363d',
        text: '#eef2f4',
        muted: '#a9b6bd',
        accent: '#a7cbdc',
        'accent-contrast': '#1a2126',
      },
    },
  ],
  css,
  defaults: { paletteId: 'birch', fontId: 'soft' },
};
