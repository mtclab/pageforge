import type { ThemePack } from '../../engine/types.js';

/*
 * midnight - neon city night. A flat, very dark backdrop with sharp accent
 * edges: dark cards outlined in 1px accent with a tight underglow, glowing
 * heading, `//` section markers and inverting tag links. For DJs, gamers,
 * streamers and nightlife people. (aurora is soft-glow; midnight is hard-edge.)
 */

const css = `/* theme: midnight */
.page {
  margin: 0 auto;
  padding: clamp(2rem, 5vw, 4rem) 1.25rem 3rem;
}
.hero { text-align: center; padding-bottom: 2.75rem; }
.hero .photo {
  width: 132px;
  height: 132px;
  margin: 0 auto 1.5rem;
  box-shadow: 0 0 0 1px var(--accent), 0 0 22px -8px var(--accent);
}
.hero h1 {
  color: var(--accent);
  letter-spacing: -0.01em;
  text-shadow: 0 0 18px color-mix(in srgb, var(--accent) 55%, transparent);
}
.tagline { margin-top: 0.5rem; }
.hero .links { justify-content: center; margin-top: 1.75rem; }
.links a {
  padding: 0.3rem 0.9rem;
  border: 1px solid var(--accent);
  border-radius: 2px;
  color: var(--accent);
  transition: background 0.15s ease, color 0.15s ease;
}
.links a:hover {
  background: var(--accent);
  color: var(--accent-contrast);
  text-decoration: none;
}
.section {
  background: color-mix(in srgb, var(--accent) 5%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  border-radius: 4px;
  padding: calc(1.5rem * var(--density));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent),
    0 0 12px -6px var(--accent);
}
.section h2 {
  color: var(--accent);
  letter-spacing: 0.02em;
}
.section h2::before { content: '// '; color: var(--accent); }
.chips li {
  border-radius: 2px;
  border-color: color-mix(in srgb, var(--accent) 50%, transparent);
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
}
footer { text-align: center; }
@media (prefers-reduced-motion: reduce) {
  .links a { transition: none; }
}
`;

export const midnight: ThemePack = {
  id: 'midnight',
  name: 'Midnight',
  tagline: 'Neon and electric',
  layout: 'card-stack',
  photoShape: 'rounded',
  pageMax: '44rem',
  fonts: [
    {
      id: 'system',
      name: 'Clean',
      stack: 'system-ui, sans-serif',
    },
    {
      id: 'condensed',
      name: 'Poster',
      stack: 'system-ui, sans-serif',
      headingStack: "'Arial Narrow', 'Helvetica Neue', system-ui, sans-serif",
    },
  ],
  palettes: [
    {
      id: 'ultraviolet',
      name: 'Ultraviolet',
      vars: {
        bg: '#0d0a14',
        surface: '#171226',
        text: '#efeafd',
        muted: '#a99fc4',
        accent: '#c77dff',
        'accent-contrast': '#170a24',
      },
    },
    {
      id: 'cyan-rush',
      name: 'Cyan Rush',
      vars: {
        bg: '#080d12',
        surface: '#101a22',
        text: '#eef6fb',
        muted: '#93aab8',
        accent: '#22d3ee',
        'accent-contrast': '#04202a',
      },
    },
    {
      id: 'red-line',
      name: 'Red Line',
      vars: {
        bg: '#12090a',
        surface: '#22110f',
        text: '#fbeee9',
        muted: '#c4a59d',
        accent: '#ff5c47',
        'accent-contrast': '#2b0a05',
      },
    },
  ],
  css,
  defaults: { paletteId: 'ultraviolet', fontId: 'system' },
};
