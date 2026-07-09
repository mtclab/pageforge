import type { ThemePack } from '../../engine/types.js';

/*
 * ink - bold statement. Full-bleed accent hero band with a huge name,
 * a readable column below, heavy headings and thick left rules.
 */

const css = `/* theme: ink */
.page { max-width: none; margin: 0; padding: 0; }
.hero {
  background: var(--accent);
  color: var(--accent-contrast);
  padding: clamp(2.5rem, 7vw, 5rem) 1.5rem clamp(2.25rem, 5vw, 3.5rem);
}
.hero > * { max-width: 44rem; margin-left: auto; margin-right: auto; }
.hero .photo {
  width: clamp(96px, 18vw, 148px);
  height: clamp(96px, 18vw, 148px);
  margin-bottom: 1.5rem;
  border: 4px solid var(--accent-contrast);
}
.hero h1 {
  font-size: clamp(3rem, 10vw, 6rem);
  font-weight: 800;
  line-height: 0.95;
  letter-spacing: -0.03em;
  text-transform: uppercase;
  color: var(--accent-contrast);
}
.hero .tagline {
  color: var(--accent-contrast);
  font-size: clamp(1.1rem, 2.5vw, 1.4rem);
  font-weight: 600;
  margin-top: 1rem;
  opacity: 0.92;
}
.hero .links { margin-top: 1.75rem; }
.hero .links a {
  color: var(--accent-contrast);
  border: 2px solid var(--accent-contrast);
  padding: 0.4rem 0.9rem;
  font-weight: 700;
}
.hero .links a:hover { background: var(--accent-contrast); color: var(--accent); text-decoration: none; }
main {
  max-width: 44rem;
  margin: 0 auto;
  padding: clamp(2rem, 5vw, 3.5rem) 1.5rem;
}
.section { border-left: 6px solid var(--accent); padding-left: 1.25rem; }
.section h2 {
  font-size: clamp(1.5rem, 1.2rem + 1.4vw, 2.1rem);
  font-weight: 800;
  letter-spacing: -0.01em;
  text-transform: uppercase;
}
.project h3 { font-weight: 800; }
.chips li { border: 2px solid var(--accent); font-weight: 600; }
footer {
  max-width: 44rem;
  margin-left: auto;
  margin-right: auto;
  padding: 0 1.5rem 3rem;
}
`;

export const ink: ThemePack = {
  id: 'ink',
  name: 'Ink',
  tagline: 'Bold and loud',
  layout: 'banner',
  photoShape: 'square',
  fonts: [
    {
      id: 'impact',
      name: 'Heavy',
      stack: "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      headingStack: "'Arial Black', 'Helvetica Neue', Impact, system-ui, sans-serif",
    },
    {
      id: 'system',
      name: 'Clean',
      stack: "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    },
  ],
  palettes: [
    {
      id: 'crimson',
      name: 'Crimson',
      vars: {
        bg: '#fbfbfa',
        surface: '#ffffff',
        text: '#1a1a1a',
        muted: '#565656',
        accent: '#b3122e',
        'accent-contrast': '#ffffff',
      },
    },
    {
      id: 'cobalt',
      name: 'Cobalt',
      vars: {
        bg: '#fafbff',
        surface: '#ffffff',
        text: '#1a1a1a',
        muted: '#565656',
        accent: '#1c40c0',
        'accent-contrast': '#ffffff',
      },
    },
    {
      id: 'acid',
      name: 'Acid',
      vars: {
        bg: '#111111',
        surface: '#1c1c1c',
        text: '#f0f0f0',
        muted: '#9a9a9a',
        accent: '#b8e62e',
        'accent-contrast': '#111111',
      },
    },
  ],
  css,
  defaults: { paletteId: 'crimson', fontId: 'impact' },
};
