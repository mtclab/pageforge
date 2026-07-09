import type { ThemePack } from '../../engine/types.js';

/*
 * blueprint - an architect's drawing. A faint drafting grid sits behind the
 * page, sections are framed by fine rules, headings read as drafting labels
 * (uppercase, index squares, a numbered project register). Where terminal is a
 * glowing CRT console, blueprint is the quiet precision of the drafting table.
 */

const css = `/* theme: blueprint */
body {
  background-image:
    linear-gradient(to right, color-mix(in srgb, var(--accent) 7%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in srgb, var(--accent) 7%, transparent) 1px, transparent 1px);
  background-size: 24px 24px;
}
.page {
  margin: 0 auto;
  padding: clamp(1.5rem, 4vw, 3rem) 1.25rem 3rem;
}
.hero, .section {
  background: var(--surface);
  border: 1px solid color-mix(in srgb, var(--muted) 42%, transparent);
  padding: 1.6rem;
}
.hero .photo {
  width: 120px; height: 120px;
  border: 1px solid var(--accent);
  box-shadow: 8px 8px 0 -6px var(--accent);
  margin-bottom: 1.1rem;
}
.hero h1 {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: calc(clamp(1.5rem, 1.2rem + 1.6vw, 2.2rem) * var(--text-factor));
  border-bottom: 1px solid var(--accent);
  padding-bottom: 0.35rem;
  position: relative;
}
.hero h1::after {
  content: '';
  position: absolute;
  left: 0; right: 0; bottom: -4px;
  height: 1px;
  background: color-mix(in srgb, var(--accent) 55%, transparent);
}
.tagline { margin-top: 0.6rem; letter-spacing: 0.04em; }
.hero .links { margin-top: 1.25rem; }
.links a {
  text-decoration-line: underline;
  text-decoration-style: dotted;
  text-underline-offset: 3px;
}
.section h2 {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 0.95rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.section h2::before {
  content: '';
  width: 8px; height: 8px;
  flex: none;
  background: var(--accent);
  display: inline-block;
}
.projects { counter-reset: reg; }
.project { counter-increment: reg; }
.project h3::before {
  content: counter(reg, decimal-leading-zero) '  ';
  color: var(--accent);
  font-family: var(--font-heading);
}
.chips li {
  background: none;
  border: 1px solid color-mix(in srgb, var(--muted) 55%, transparent);
  border-radius: 0;
}
footer {
  text-align: right;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
`;

export const blueprint: ThemePack = {
  id: 'blueprint',
  name: 'Blueprint',
  tagline: 'Drafted and precise',
  layout: 'centered-column',
  photoShape: 'square',
  pageMax: '44rem',
  fonts: [
    {
      id: 'draft',
      name: 'Drafting',
      stack: "'Segoe UI', system-ui, sans-serif",
      headingStack: "ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace",
    },
    {
      id: 'inked',
      name: 'Inked',
      stack: "Georgia, 'Times New Roman', serif",
      headingStack: "ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace",
    },
  ],
  palettes: [
    {
      id: 'cyanotype',
      name: 'Cyanotype',
      vars: {
        bg: '#0f2f52',
        surface: '#163a63',
        text: '#eef4fb',
        muted: '#93b0c8',
        accent: '#bfe3f0',
        'accent-contrast': '#0f2f52',
      },
    },
    {
      id: 'vellum',
      name: 'Vellum',
      vars: {
        bg: '#f3efe4',
        surface: '#faf7ef',
        text: '#26303a',
        muted: '#52606d',
        accent: '#1d4e89',
        'accent-contrast': '#ffffff',
      },
    },
    {
      id: 'graphite-draft',
      name: 'Graphite Draft',
      vars: {
        bg: '#e9e9ea',
        surface: '#f5f5f6',
        text: '#1a1c1f',
        muted: '#5c6066',
        accent: '#a01c28',
        'accent-contrast': '#ffffff',
      },
    },
  ],
  css,
  defaults: { paletteId: 'vellum', fontId: 'draft' },
};
