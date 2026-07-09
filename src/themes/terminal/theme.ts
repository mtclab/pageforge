import type { ThemePack } from '../../engine/types.js';

/*
 * terminal - playful and techy. Monospace everything, each section is a
 * bordered "window" card with an accent top bar and a `$ ` prompt heading.
 */

const css = `/* theme: terminal */
.page {
  margin: 0 auto;
  padding: clamp(1.5rem, 4vw, 3rem) 1.25rem 3rem;
}
.hero, .section {
  background: var(--surface);
  border: 1px solid color-mix(in srgb, var(--muted) 45%, transparent);
  border-top: 3px solid var(--accent);
  border-radius: 4px;
  padding: 1.5rem;
}
.hero { padding-bottom: 1.75rem; }
.hero .photo {
  width: 120px; height: 120px;
  border: 2px solid var(--accent);
  image-rendering: pixelated;
  margin-bottom: 1rem;
}
.hero h1::before { content: '> '; color: var(--accent); }
.hero h1::after {
  content: '\\258B';
  color: var(--accent);
  animation: blink 1.2s step-end infinite;
}
@keyframes blink { 0%, 50% { opacity: 1; } 50.01%, 100% { opacity: 0; } }
.tagline { margin-top: 0.5rem; }
.hero .links { margin-top: 1.25rem; }
.links a { text-decoration: none; }
.links a::before { content: '['; color: var(--muted); }
.links a::after { content: ']'; color: var(--muted); }
.section h2::before { content: '$ '; color: var(--accent); }
.section h2 {
  font-size: 1.05rem;
  letter-spacing: 0.02em;
}
.project h3::before { content: '# '; color: var(--muted); }
.chips li { border-color: color-mix(in srgb, var(--muted) 55%, transparent); border-radius: 2px; }
.chips li::before { content: '~/'; color: var(--muted); }
footer { text-align: center; }
footer::before { content: '// '; color: var(--muted); }
@media (prefers-reduced-motion: reduce) {
  .hero h1::after { animation: none; }
}
`;

export const terminal: ThemePack = {
  id: 'terminal',
  name: 'Terminal',
  tagline: 'Playful and techy',
  layout: 'card-stack',
  photoShape: 'square',
  pageMax: '44rem',
  fonts: [
    {
      id: 'mono',
      name: 'Terminal',
      stack: "ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace",
    },
    {
      id: 'mono-soft',
      name: 'Typewriter',
      stack: "'Courier New', Courier, monospace",
    },
  ],
  palettes: [
    {
      id: 'green',
      name: 'Green',
      vars: {
        bg: '#0a0f0a',
        surface: '#111a11',
        text: '#c8f0cc',
        muted: '#7fa886',
        accent: '#33ff66',
        'accent-contrast': '#001100',
      },
    },
    {
      id: 'amber',
      name: 'Amber',
      vars: {
        bg: '#100c05',
        surface: '#1a1409',
        text: '#f0dcb4',
        muted: '#b39a72',
        accent: '#ffb000',
        'accent-contrast': '#1a1000',
      },
    },
    {
      id: 'light',
      name: 'Light',
      vars: {
        bg: '#f6f4ee',
        surface: '#ffffff',
        text: '#22292b',
        muted: '#5a6568',
        accent: '#0f6b6b',
        'accent-contrast': '#ffffff',
      },
    },
  ],
  css,
  defaults: { paletteId: 'green', fontId: 'mono' },
};
