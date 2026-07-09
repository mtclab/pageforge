import type { ThemePack } from '../../engine/types.js';

/*
 * studio - contemporary, work-forward portfolio. Crisp near-flat design,
 * generous whitespace, compact left-aligned hero, projects as a bordered
 * tile grid, sharp-cornered gallery, tiny uppercase index labels.
 */

const css = `/* theme: studio */
.page {
  margin: 0;
  padding: clamp(2rem, 5vw, 4rem) clamp(1.25rem, 4vw, 3rem) 3rem;
}
.hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1rem;
  padding-bottom: 2.5rem;
}
.hero .photo { width: 88px; height: 88px; }
.hero h1 { letter-spacing: -0.04em; font-weight: 800; }
.tagline { margin-top: 0.25rem; }
.hero .links { margin-top: 0.75rem; gap: 0.4rem 1.25rem; }
.hero .links a { color: var(--muted); font-size: 0.9rem; }
.hero .links a:hover { color: var(--accent); }
.section h2 {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
}
.section h2::before {
  content: "";
  width: 0.8rem;
  height: 2px;
  background: var(--accent);
  flex: none;
}
.projects { grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr)); }
.project {
  border: 1px solid color-mix(in srgb, var(--muted) 35%, transparent);
  padding: 1.25rem;
  transition: transform 0.15s ease, border-color 0.15s ease;
}
.project:hover {
  transform: translateY(-3px);
  border-color: var(--accent);
}
.project h3 { letter-spacing: -0.02em; }
.gallery { gap: 4px; }
.gallery img { border-radius: 0; }
.chips li {
  border-radius: 0;
  border-color: color-mix(in srgb, var(--muted) 45%, transparent);
}
footer { border-top: 1px solid color-mix(in srgb, var(--muted) 30%, transparent); padding-top: 1.5rem; }
@media (prefers-reduced-motion: reduce) {
  .project, .project:hover { transition: none; transform: none; }
}
`;

export const studio: ThemePack = {
  id: 'studio',
  name: 'Studio',
  tagline: 'Work-forward portfolio',
  layout: 'card-stack',
  photoShape: 'square',
  pageMax: '52rem',
  fonts: [
    {
      id: 'grotesk',
      name: 'Modern',
      stack: "'Helvetica Neue', 'Segoe UI', system-ui, sans-serif",
      headingStack: "'Helvetica Neue', 'Segoe UI', system-ui, sans-serif",
    },
    {
      id: 'mono-label',
      name: 'Technical',
      stack: "'Helvetica Neue', 'Segoe UI', system-ui, sans-serif",
      headingStack: 'ui-monospace, Menlo, Consolas, monospace',
    },
  ],
  palettes: [
    {
      id: 'gallery-white',
      name: 'Gallery White',
      vars: {
        bg: '#fbfbfa',
        surface: '#ffffff',
        text: '#111111',
        muted: '#565656',
        accent: '#111111',
        'accent-contrast': '#ffffff',
      },
    },
    {
      id: 'concrete',
      name: 'Concrete',
      vars: {
        bg: '#ecebe7',
        surface: '#f6f5f2',
        text: '#23201c',
        muted: '#5c574f',
        accent: '#a83c00',
        'accent-contrast': '#ffffff',
      },
    },
    {
      id: 'darkroom',
      name: 'Darkroom',
      vars: {
        bg: '#0e0f10',
        surface: '#1a1c1e',
        text: '#d6d9dc',
        muted: '#969ca1',
        accent: '#22d3ee',
        'accent-contrast': '#06272c',
      },
    },
  ],
  css,
  defaults: { paletteId: 'gallery-white', fontId: 'grotesk' },
};
