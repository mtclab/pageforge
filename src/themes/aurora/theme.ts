import type { ThemePack } from '../../engine/types.js';

/*
 * aurora - dark, elegant, atmospheric. A deep dark backdrop with a quiet
 * accent wash, gradient heading, glowing photo and pill links. For creatives,
 * musicians and night-owl personal pages.
 */

const css = `/* theme: aurora */
body {
  background:
    radial-gradient(120% 80% at 50% -10%,
      color-mix(in srgb, var(--accent) 10%, var(--bg)), var(--bg) 60%)
    fixed;
  min-height: 100vh;
}
.page {
  max-width: 42rem;
  margin: 0 auto;
  padding: clamp(2rem, 5vw, 4rem) 1.25rem 3rem;
}
.hero { text-align: center; padding-bottom: 2.5rem; }
.hero .photo {
  width: 128px;
  height: 128px;
  margin: 0 auto 1.5rem;
  box-shadow: 0 0 24px color-mix(in srgb, var(--accent) 40%, transparent);
}
.hero h1 {
  color: var(--accent);
  background: linear-gradient(90deg, var(--accent),
    color-mix(in srgb, var(--accent) 45%, #ffffff));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -0.01em;
}
.tagline { margin-top: 0.5rem; }
.hero .links { justify-content: center; margin-top: 1.75rem; }
.links a {
  padding: 0.35rem 0.95rem;
  border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
  border-radius: 999px;
  color: var(--accent);
  transition: background 0.15s ease, color 0.15s ease;
}
.links a:hover {
  background: var(--accent);
  color: var(--accent-contrast);
  text-decoration: none;
}
.section h2 {
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
}
.section {
  padding-bottom: 2.5rem;
  border-bottom: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  box-shadow: 0 1px 12px color-mix(in srgb, var(--accent) 14%, transparent);
}
.section:last-child { border-bottom: none; box-shadow: none; }
.chips li { border-color: color-mix(in srgb, var(--accent) 40%, transparent); }
footer { text-align: center; }
@media (prefers-reduced-motion: reduce) {
  .links a { transition: none; }
}
`;

export const aurora: ThemePack = {
  id: 'aurora',
  name: 'Aurora',
  tagline: 'Dark and atmospheric',
  layout: 'centered-column',
  photoShape: 'circle',
  fonts: [
    {
      id: 'system',
      name: 'Clean',
      stack: "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    },
    {
      id: 'display',
      name: 'Elegant',
      stack: "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      headingStack: "Georgia, 'Times New Roman', serif",
    },
  ],
  palettes: [
    {
      id: 'polar',
      name: 'Polar',
      vars: {
        bg: '#0a0e12',
        surface: '#141a20',
        text: '#eef2f0',
        muted: '#9fb0ab',
        accent: '#6fe3a1',
        'accent-contrast': '#06210f',
      },
    },
    {
      id: 'violet',
      name: 'Violet',
      vars: {
        bg: '#0c0a14',
        surface: '#171426',
        text: '#efecf5',
        muted: '#aaa2c0',
        accent: '#c4a7ff',
        'accent-contrast': '#1a0f33',
      },
    },
    {
      id: 'ember',
      name: 'Ember',
      vars: {
        bg: '#120c09',
        surface: '#211711',
        text: '#f4ede8',
        muted: '#c0a89c',
        accent: '#ffab6b',
        'accent-contrast': '#331605',
      },
    },
  ],
  css,
  defaults: { paletteId: 'polar', fontId: 'system' },
};
