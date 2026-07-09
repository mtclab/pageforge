import type { ThemePack } from '../../engine/types.js';

/*
 * atelier - professional, CV-like. A typeset sidebar hero (photo, name,
 * tagline, stacked links) sits sticky on the left; content flows on the right.
 * For freelancers and consultants who want a polished resume of a homepage.
 */

const css = `/* theme: atelier */
.page {
  display: grid;
  grid-template-columns: 17rem 1fr;
  align-items: start;
  gap: clamp(1.5rem, 4vw, 3.5rem);
  margin: 0 auto;
  padding: clamp(1.5rem, 4vw, 3rem);
}
.hero {
  grid-row: 1 / -1;
  position: sticky;
  top: 0;
  align-self: start;
  background: var(--surface);
  border-right: 1px solid color-mix(in srgb, var(--muted) 30%, transparent);
  padding: clamp(1.25rem, 3vw, 2rem);
  margin: calc(-1 * clamp(1.5rem, 4vw, 3rem)) 0;
  min-height: 100vh;
}
.hero .photo { width: 120px; height: 120px; margin-bottom: 1.25rem; }
.hero h1 { font-size: clamp(1.7rem, 1.4rem + 1vw, 2.2rem); letter-spacing: -0.01em; }
.tagline { margin-top: 0.35rem; font-size: 0.95rem; }
.hero .links {
  flex-direction: column;
  gap: 0.55rem;
  margin-top: 1.5rem;
}
.hero .links a { font-size: 0.95rem; }
.hero .links .icon { color: var(--accent); }
main { padding-top: clamp(0.5rem, 2vw, 1.5rem); }
.section h2 {
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
  padding-bottom: 0.5rem;
  border-bottom: 1px solid color-mix(in srgb, var(--muted) 30%, transparent);
}
.project h3 { font-size: 1.05rem; }
.chips li { border-color: color-mix(in srgb, var(--muted) 45%, transparent); }
@media (max-width: 46rem) {
  .page { display: block; padding: 0; max-width: none; }
  .hero {
    position: static;
    min-height: 0;
    margin: 0;
    border-right: none;
    border-bottom: 1px solid color-mix(in srgb, var(--muted) 30%, transparent);
  }
  .hero .photo { margin-left: 0; }
  main, footer { padding: clamp(1.5rem, 5vw, 2.5rem); padding-top: 1.5rem; }
}
`;

export const atelier: ThemePack = {
  id: 'atelier',
  name: 'Atelier',
  tagline: 'Professional and polished',
  layout: 'split-hero',
  photoShape: 'rounded',
  pageMax: '66rem',
  fonts: [
    {
      id: 'grotesk',
      name: 'Modern',
      stack: "'Helvetica Neue', 'Segoe UI', system-ui, sans-serif",
    },
    {
      id: 'editorial',
      name: 'Editorial',
      stack: "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      headingStack: "Georgia, 'Times New Roman', serif",
    },
  ],
  palettes: [
    {
      id: 'navy',
      name: 'Navy',
      vars: {
        bg: '#ffffff',
        surface: '#f2f5fb',
        text: '#1f2430',
        muted: '#565f70',
        accent: '#1d3a8a',
        'accent-contrast': '#ffffff',
      },
    },
    {
      id: 'charcoal',
      name: 'Charcoal',
      vars: {
        bg: '#f5f3f0',
        surface: '#ffffff',
        text: '#1c1b19',
        muted: '#5c584f',
        accent: '#2a2724',
        'accent-contrast': '#ffffff',
      },
    },
    {
      id: 'burgundy',
      name: 'Burgundy',
      vars: {
        bg: '#ffffff',
        surface: '#faf4f4',
        text: '#241b1d',
        muted: '#655056',
        accent: '#7a1f34',
        'accent-contrast': '#ffffff',
      },
    },
  ],
  css,
  defaults: { paletteId: 'navy', fontId: 'grotesk' },
};
