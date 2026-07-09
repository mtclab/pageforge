import type { ThemePack } from '../../engine/types.js';

/*
 * zine - DIY punk photocopy energy. Sections are pasted-on flyers with thick
 * borders and a small deterministic tilt; headings are tape labels and offset
 * boxes. The loudness lives in frames and headings; body text stays plain.
 */

const css = `/* theme: zine */
.page { max-width: var(--page-max); margin: 0 auto; padding: clamp(1.5rem, 4vw, 2.5rem) 1.25rem; }
.hero { text-align: left; margin-bottom: calc(2.5rem * var(--density)); }
.hero .photo {
  width: clamp(96px, 20vw, 150px);
  height: clamp(96px, 20vw, 150px);
  border: 3px solid var(--text);
  margin-bottom: 1.25rem;
}
.hero h1 {
  display: inline-block;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.01em;
  box-shadow: 4px 4px 0 var(--accent);
}
.hero .tagline { margin-top: 1.25rem; font-weight: 600; }
.hero .links { margin-top: 1.25rem; }
.hero .links a {
  font-weight: 700;
  text-decoration: underline;
  text-decoration-color: var(--accent);
  text-decoration-thickness: 3px;
  text-underline-offset: 3px;
}
.section {
  background: var(--surface);
  border: 3px solid var(--text);
  padding: calc(1.4rem * var(--density));
}
.section:nth-child(odd) { transform: rotate(-0.6deg); }
.section:nth-child(even) { transform: rotate(0.5deg); }
.section h2 {
  display: inline-block;
  background: var(--text);
  color: var(--bg);
  padding: 0.2rem 0.7rem;
  transform: rotate(-1deg);
  text-transform: uppercase;
  font-weight: 800;
}
.project h3 { font-weight: 800; text-transform: uppercase; }
.chips li {
  background: var(--surface);
  border: 2px solid var(--text);
  border-radius: 0;
  font-weight: 700;
}
footer { border-top: 3px solid var(--text); margin-top: 3rem; padding-top: 1rem; }
@media (prefers-reduced-motion: reduce) {
  .section, .section h2 { transform: none; }
}
`;

export const zine: ThemePack = {
  id: 'zine',
  name: 'Zine',
  tagline: 'DIY and loud',
  layout: 'centered-column',
  photoShape: 'square',
  pageMax: '40rem',
  fonts: [
    {
      id: 'punch',
      name: 'Punch',
      stack: "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      headingStack: "'Arial Black', 'Helvetica Neue', system-ui, sans-serif",
    },
    {
      id: 'typewriter',
      name: 'Typewriter',
      stack: "'Courier New', Courier, monospace",
      headingStack: "'Arial Black', system-ui, sans-serif",
    },
  ],
  palettes: [
    {
      id: 'photocopy',
      name: 'Photocopy',
      vars: {
        bg: '#ffffff',
        surface: '#ffffff',
        text: '#000000',
        muted: '#565656',
        accent: '#c0186c',
        'accent-contrast': '#ffffff',
      },
    },
    {
      id: 'flyer',
      name: 'Flyer',
      vars: {
        bg: '#fdf6d8',
        surface: '#fffdf2',
        text: '#111111',
        muted: '#525252',
        accent: '#123a8c',
        'accent-contrast': '#ffffff',
      },
    },
    {
      id: 'basement',
      name: 'Basement',
      vars: {
        bg: '#111111',
        surface: '#1b1b1b',
        text: '#f0f0f0',
        muted: '#a8a8a8',
        accent: '#e6e600',
        'accent-contrast': '#111111',
      },
    },
  ],
  css,
  defaults: { paletteId: 'photocopy', fontId: 'punch' },
};
