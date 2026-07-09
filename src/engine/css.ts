import type { Font, Palette } from './types.js';

/** Reset + shared structure every theme builds on. Themes append their own CSS after this. */
export const BASE_CSS = `/* base */
*, *::before, *::after { box-sizing: border-box; }
* { margin: 0; }
html { -webkit-text-size-adjust: 100%; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-body);
  line-height: 1.6;
  font-size: clamp(1rem, 0.95rem + 0.3vw, 1.125rem);
}
img { display: block; max-width: 100%; }
h1, h2, h3 { font-family: var(--font-heading); line-height: 1.2; overflow-wrap: break-word; }
h1 { font-size: clamp(1.9rem, 1.4rem + 2.5vw, 3rem); }
h2 { font-size: clamp(1.25rem, 1.1rem + 0.8vw, 1.6rem); }
p, li { overflow-wrap: break-word; }
a { color: var(--accent); }
a:hover { text-decoration-thickness: 2px; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.hero .photo { object-fit: cover; }
.photo-circle .hero .photo { border-radius: 50%; }
.photo-rounded .hero .photo { border-radius: 16px; }

.tagline { color: var(--muted); }

.links { display: flex; flex-wrap: wrap; gap: 0.6rem 1rem; }
.links a {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  text-decoration: none;
}
.links a:hover { text-decoration: underline; }
.links .icon { width: 1.1em; height: 1.1em; flex: none; fill: currentColor; }

.section { margin-top: 2.5rem; }
.section h2 { margin-bottom: 0.8rem; }
.section p + p { margin-top: 0.8rem; }

.projects { display: grid; gap: 1rem; padding: 0; list-style: none; }
.project .desc { color: var(--muted); }

.chips { display: flex; flex-wrap: wrap; gap: 0.5rem; padding: 0; list-style: none; }
.chips li {
  background: var(--surface);
  border: 1px solid var(--muted);
  border-radius: 999px;
  padding: 0.2rem 0.8rem;
}

footer { margin-top: 3rem; color: var(--muted); font-size: 0.875rem; }
footer a { color: inherit; }

@media print {
  body { background: #fff; color: #000; }
  .links a { text-decoration: none; color: #000; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
`;

/** Palette + font choices become CSS custom properties on :root. */
export function rootVars(palette: Palette, font: Font): string {
  const v = palette.vars;
  return `:root {
  --bg: ${v.bg};
  --surface: ${v.surface};
  --text: ${v.text};
  --muted: ${v.muted};
  --accent: ${v.accent};
  --accent-contrast: ${v['accent-contrast']};
  --font-body: ${font.stack};
  --font-heading: ${font.headingStack ?? font.stack};
}
`;
}
