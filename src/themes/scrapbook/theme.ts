import type { ThemePack } from '../../engine/types.js';

/*
 * scrapbook - crafty, personal, family album. Warm paper background, sections
 * as white paper pieces glued on with a soft shadow, a small deterministic
 * tilt and a washi-tape strip. Photos read like instant-camera prints. Made
 * for family pages, baby pages, hobby crafters and memory pages.
 */

const css = `/* theme: scrapbook */
.page {
  margin: 0 auto;
  padding: clamp(2rem, 5vw, 3.5rem) 1.25rem 3.5rem;
}
.hero { text-align: center; padding-bottom: 2.25rem; }
.hero .photo {
  width: 150px;
  height: 150px;
  margin: 0 auto 1.4rem;
  padding: 8px;
  background: #ffffff;
  box-shadow: 0 6px 20px color-mix(in srgb, var(--text) 22%, transparent);
}
.hero h1 { font-weight: 800; letter-spacing: -0.01em; }
.tagline { margin-top: 0.5rem; }
.hero .links { justify-content: center; margin-top: 1.6rem; }
.section {
  position: relative;
  background: #ffffff;
  padding: 2.1rem 1.9rem 2rem;
  box-shadow: 0 5px 16px color-mix(in srgb, var(--text) 16%, transparent);
}
.section:nth-child(odd) { transform: rotate(0.4deg); }
.section:nth-child(even) { transform: rotate(-0.4deg); }
.section::before {
  content: "";
  position: absolute;
  top: -11px;
  left: 50%;
  width: 90px;
  height: 22px;
  transform: translateX(-50%) rotate(-1.6deg);
  background: color-mix(in srgb, var(--accent) 45%, transparent);
  box-shadow: 0 1px 3px color-mix(in srgb, var(--text) 18%, transparent);
}
.section h2 {
  font-family: 'Segoe Print', 'Comic Sans MS', 'Trebuchet MS', cursive;
  color: var(--accent);
}
.projects { gap: 1.2rem; }
.project h3 { font-size: 1.12rem; color: var(--accent); }
.chips li {
  border: none;
  background: color-mix(in srgb, var(--accent) 15%, #ffffff);
  color: var(--text);
  padding: 0.3rem 0.95rem;
}
.gallery img {
  padding: 8px;
  background: #ffffff;
  box-shadow: 0 4px 12px color-mix(in srgb, var(--text) 18%, transparent);
}
footer {
  text-align: center;
  font-family: 'Segoe Print', 'Comic Sans MS', 'Trebuchet MS', cursive;
}
@media (prefers-reduced-motion: reduce) {
  .section:nth-child(odd), .section:nth-child(even) { transform: none; }
}
`;

export const scrapbook: ThemePack = {
  id: 'scrapbook',
  name: 'Scrapbook',
  tagline: 'Crafty and personal',
  layout: 'centered-column',
  photoShape: 'square',
  pageMax: '40rem',
  fonts: [
    {
      id: 'friendly',
      name: 'Friendly',
      stack: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
    },
    {
      id: 'jotted',
      name: 'Jotted',
      stack: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
      headingStack: "'Segoe Print', 'Comic Sans MS', 'Trebuchet MS', cursive",
    },
  ],
  palettes: [
    {
      id: 'kraft',
      name: 'Kraft',
      vars: {
        bg: '#f3ead9',
        surface: '#ffffff',
        text: '#3a2c1c',
        muted: '#6b5842',
        accent: '#9c2f26',
        'accent-contrast': '#ffffff',
      },
    },
    {
      id: 'polka',
      name: 'Polka',
      vars: {
        bg: '#fbf4ec',
        surface: '#ffffff',
        text: '#332028',
        muted: '#6a4f5a',
        accent: '#9a2f57',
        'accent-contrast': '#ffffff',
      },
    },
    {
      id: 'denim',
      name: 'Denim',
      vars: {
        bg: '#e9eef4',
        surface: '#ffffff',
        text: '#1e2a3a',
        muted: '#485468',
        accent: '#274b7a',
        'accent-contrast': '#ffffff',
      },
    },
  ],
  css,
  defaults: { paletteId: 'kraft', fontId: 'friendly' },
};
