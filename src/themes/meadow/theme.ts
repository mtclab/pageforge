import type { ThemePack } from '../../engine/types.js';

/*
 * meadow - playful, friendly, pastel. Soft pastel background, big rounded
 * cards, colorful accent-tinted chips. Made for event, family and club pages.
 */

const css = `/* theme: meadow */
.page {
  margin: 0 auto;
  padding: clamp(2rem, 5vw, 3.5rem) 1.25rem 3.5rem;
}
.hero { text-align: center; padding-bottom: 2.25rem; }
.hero .photo {
  width: 140px;
  height: 140px;
  margin: 0 auto 1.4rem;
  border: 6px solid var(--surface);
  box-shadow: 0 6px 22px color-mix(in srgb, var(--accent) 22%, transparent);
}
.hero h1 { letter-spacing: -0.01em; }
.tagline { margin-top: 0.5rem; }
.hero .links { justify-content: center; margin-top: 1.6rem; }
.section {
  background: var(--surface);
  border-radius: 20px;
  padding: 1.9rem 1.9rem 2rem;
  box-shadow: 0 6px 20px color-mix(in srgb, var(--accent) 12%, transparent);
}
.section h2 {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--accent);
}
.section h2::before {
  content: "";
  width: 0.7em;
  height: 0.7em;
  flex: none;
  border-radius: 50% 50% 50% 0;
  background: var(--accent);
}
.projects { gap: 1.2rem; }
.project h3 { font-size: 1.12rem; color: var(--accent); }
.chips li {
  border: none;
  background: color-mix(in srgb, var(--accent) 15%, var(--surface));
  color: var(--text);
  padding: 0.3rem 0.95rem;
}
footer { text-align: center; }
`;

export const meadow: ThemePack = {
  id: 'meadow',
  name: 'Meadow',
  tagline: 'Bright and friendly',
  layout: 'centered-column',
  photoShape: 'circle',
  pageMax: '40rem',
  fonts: [
    {
      id: 'rounded',
      name: 'Friendly',
      stack: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
    },
    {
      id: 'system',
      name: 'Clean',
      stack: 'system-ui, sans-serif',
    },
  ],
  palettes: [
    {
      id: 'meadow',
      name: 'Meadow',
      vars: {
        bg: '#eef6e8',
        surface: '#ffffff',
        text: '#22301c',
        muted: '#4c5a44',
        accent: '#2f6b2a',
        'accent-contrast': '#ffffff',
      },
    },
    {
      id: 'sky',
      name: 'Sky',
      vars: {
        bg: '#e8f0fb',
        surface: '#ffffff',
        text: '#1c2733',
        muted: '#465264',
        accent: '#1f5a99',
        'accent-contrast': '#ffffff',
      },
    },
    {
      id: 'berry',
      name: 'Berry',
      vars: {
        bg: '#fbe8f2',
        surface: '#ffffff',
        text: '#33202b',
        muted: '#64465a',
        accent: '#9a2a6b',
        'accent-contrast': '#ffffff',
      },
    },
  ],
  css,
  defaults: { paletteId: 'meadow', fontId: 'rounded' },
};
