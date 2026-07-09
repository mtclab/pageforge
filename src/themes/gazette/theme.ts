import type { ThemePack } from '../../engine/types.js';

/*
 * gazette - editorial and literary. Masthead double-rule over a centered
 * hero, small-caps tagline, section headings flanked by short rules,
 * typographic underlined links. Serif with presence; ragged right.
 */

const css = `/* theme: gazette */
.page {
  margin: 0 auto;
  padding: clamp(2rem, 5vw, 4rem) 1.25rem 3rem;
}
.hero {
  text-align: center;
  position: relative;
  border-top: 3px solid var(--text);
  padding-top: 1.9rem;
  padding-bottom: 2.25rem;
}
.hero::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 5px;
  height: 1px;
  background: var(--text);
}
.hero .photo { width: 132px; height: 132px; margin: 0 auto 1.25rem; }
.hero h1 { letter-spacing: 0.02em; }
.tagline {
  margin-top: 0.6rem;
  font-variant: small-caps;
  text-transform: lowercase;
  letter-spacing: 0.18em;
  font-size: 0.95rem;
}
.hero .links { justify-content: center; margin-top: 1.6rem; }
.links a {
  color: var(--text);
  gap: 0;
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--accent) 55%, transparent);
  text-underline-offset: 3px;
}
.links a:hover { color: var(--accent); }
.links .icon { display: none; }
.section { margin-top: calc(3rem * var(--density)); }
.section h2 {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.9rem;
  text-align: center;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.section h2::before, .section h2::after {
  content: '';
  height: 1px;
  width: 2.5rem;
  background: color-mix(in srgb, var(--muted) 60%, transparent);
}
.section-about p:first-of-type { font-size: 1.15em; line-height: 1.65; }
.project h3 { font-size: 1.05rem; }
footer { text-align: center; }
`;

export const gazette: ThemePack = {
  id: 'gazette',
  name: 'Gazette',
  tagline: 'Editorial and literary',
  layout: 'centered-column',
  photoShape: 'rounded',
  pageMax: '46rem',
  fonts: [
    {
      id: 'editorial',
      name: 'Editorial',
      stack: "Georgia, 'Times New Roman', 'Iowan Old Style', serif",
      headingStack: "Georgia, 'Times New Roman', serif",
    },
    {
      id: 'modern',
      name: 'Modern',
      stack: "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      headingStack: "Georgia, 'Times New Roman', serif",
    },
  ],
  palettes: [
    {
      id: 'ivory',
      name: 'Ivory',
      vars: {
        bg: '#fbf9f4',
        surface: '#ffffff',
        text: '#1a1a1a',
        muted: '#595959',
        accent: '#9c1b1b',
        'accent-contrast': '#ffffff',
      },
    },
    {
      id: 'stone',
      name: 'Stone',
      vars: {
        bg: '#eef1f3',
        surface: '#ffffff',
        text: '#1c2226',
        muted: '#545c62',
        accent: '#0f5b5b',
        'accent-contrast': '#ffffff',
      },
    },
    {
      id: 'night-desk',
      name: 'Night Desk',
      vars: {
        bg: '#1a1613',
        surface: '#241f1a',
        text: '#f2ebdd',
        muted: '#b0a48f',
        accent: '#e0a83a',
        'accent-contrast': '#1a1613',
      },
    },
  ],
  css,
  defaults: { paletteId: 'ivory', fontId: 'editorial' },
};
