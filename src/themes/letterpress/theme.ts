import type { ThemePack } from '../../engine/types.js';

/*
 * letterpress - pressed-into-paper elegance for invitations, weddings and
 * celebrations. Everything centered under a small circular portrait, a fine
 * double-rule frame around the page, ornamental fleurons between sections,
 * small-caps text links and an italic serif tagline. Generous vertical air.
 */

const css = `/* theme: letterpress */
.page {
  margin: 0 auto;
  padding: clamp(2.5rem, 6vw, 4rem) clamp(1.25rem, 5vw, 3rem);
  border: 3px double color-mix(in srgb, var(--muted) 55%, transparent);
}
.hero { text-align: center; }
.hero .photo {
  width: 100px;
  height: 100px;
  margin: 0 auto 1.4rem;
  box-shadow: 0 0 0 3px var(--bg), 0 0 0 4px color-mix(in srgb, var(--muted) 70%, transparent);
}
.hero h1 {
  letter-spacing: 0.04em;
  color: color-mix(in srgb, var(--text) 88%, var(--muted));
  text-shadow: 0 1px 0 color-mix(in srgb, var(--bg) 75%, #ffffff);
}
.tagline {
  margin-top: 0.7rem;
  font-family: var(--font-heading);
  font-style: italic;
  font-size: 1.05rem;
}
.hero .links { justify-content: center; margin-top: 1.5rem; }
.links a {
  color: var(--text);
  gap: 0;
  font-variant: small-caps;
  text-transform: lowercase;
  letter-spacing: 0.12em;
}
.links a:hover { color: var(--accent); }
.links .icon { display: none; }
.section { margin-top: calc(3.25rem * var(--density)); text-align: center; }
.section::before {
  content: '\\2766';
  display: block;
  text-align: center;
  color: color-mix(in srgb, var(--muted) 75%, transparent);
  font-size: 1.15rem;
  margin-bottom: 1.75rem;
}
.section h2 { letter-spacing: 0.04em; font-weight: 600; }
.section-about p:first-of-type { font-size: 1.1em; line-height: 1.7; }
.projects, .chips, .gallery { justify-content: center; }
.projects { text-align: center; }
.project h3 { font-size: 1.05rem; letter-spacing: 0.02em; }
.chips { justify-content: center; }
footer { text-align: center; }
`;

export const letterpress: ThemePack = {
  id: 'letterpress',
  name: 'Letterpress',
  tagline: 'Elegant and formal',
  layout: 'centered-column',
  photoShape: 'circle',
  pageMax: '38rem',
  fonts: [
    {
      id: 'press',
      name: 'Classic',
      stack: "Georgia, 'Times New Roman', serif",
      headingStack: "Georgia, 'Times New Roman', serif",
    },
    {
      id: 'mixed',
      name: 'Modern mix',
      stack: "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      headingStack: "Georgia, 'Times New Roman', serif",
    },
  ],
  palettes: [
    {
      id: 'cotton',
      name: 'Cotton',
      vars: {
        bg: '#faf8f5',
        surface: '#ffffff',
        text: '#2a2622',
        muted: '#6b6252',
        accent: '#7a6015',
        'accent-contrast': '#ffffff',
      },
    },
    {
      id: 'sage-press',
      name: 'Sage Press',
      vars: {
        bg: '#eef2ec',
        surface: '#ffffff',
        text: '#1c261e',
        muted: '#556b57',
        accent: '#2f5d3a',
        'accent-contrast': '#ffffff',
      },
    },
    {
      id: 'midnight-invite',
      name: 'Midnight Invite',
      vars: {
        bg: '#12172a',
        surface: '#1b2137',
        text: '#f3ecdd',
        muted: '#9c957f',
        accent: '#e6c98f',
        'accent-contrast': '#12172a',
      },
    },
  ],
  css,
  defaults: { paletteId: 'cotton', fontId: 'press' },
};
