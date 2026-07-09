import type { ThemePack } from '../../engine/types.js';

/*
 * linen - warm and personal. Centered narrow column, serif headings,
 * soft rounded cards on a warm background. Feels like a hand-written letter.
 */

const css = `/* theme: linen */
.page {
  margin: 0 auto;
  padding: clamp(2rem, 5vw, 3.5rem) 1.25rem 3rem;
}
.hero { text-align: center; padding-bottom: 2rem; }
.hero .photo {
  width: 132px;
  height: 132px;
  margin: 0 auto 1.25rem;
  border: 3px solid color-mix(in srgb, var(--accent) 55%, transparent);
  box-shadow: 0 6px 20px color-mix(in srgb, var(--text) 12%, transparent);
}
.hero h1 { letter-spacing: -0.005em; }
.tagline { margin-top: 0.5rem; font-style: italic; }
.hero .links { justify-content: center; margin-top: 1.5rem; }
.section {
  background: var(--surface);
  border-radius: 20px;
  padding: 1.75rem 1.75rem 1.9rem;
  box-shadow: 0 4px 16px color-mix(in srgb, var(--text) 8%, transparent);
}
.section h2 { color: var(--accent); }
.projects { gap: 1.1rem; }
.project h3 { font-size: 1.1rem; }
.chips li {
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
}
footer { text-align: center; }
`;

export const linen: ThemePack = {
  id: 'linen',
  name: 'Linen',
  tagline: 'Warm and personal',
  layout: 'centered-column',
  photoShape: 'circle',
  pageMax: '40rem',
  fonts: [
    {
      id: 'humanist',
      name: 'Friendly',
      stack: "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      headingStack: "Georgia, 'Times New Roman', serif",
    },
    {
      id: 'rounded',
      name: 'Soft',
      stack: "'Avenir Next', 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
    },
  ],
  palettes: [
    {
      id: 'clay',
      name: 'Clay',
      vars: {
        bg: '#faf5ef',
        surface: '#ffffff',
        text: '#3a2f28',
        muted: '#6f6157',
        accent: '#b23a1e',
        'accent-contrast': '#ffffff',
      },
    },
    {
      id: 'moss',
      name: 'Moss',
      vars: {
        bg: '#f5f3e8',
        surface: '#fffdf6',
        text: '#2f2f24',
        muted: '#5f6150',
        accent: '#3f6b32',
        'accent-contrast': '#ffffff',
      },
    },
    {
      id: 'dusk',
      name: 'Dusk',
      vars: {
        bg: '#2a2020',
        surface: '#372a2a',
        text: '#f2e6dd',
        muted: '#c1a99c',
        accent: '#f0b464',
        'accent-contrast': '#2a2020',
      },
    },
  ],
  css,
  defaults: { paletteId: 'clay', fontId: 'humanist' },
};
