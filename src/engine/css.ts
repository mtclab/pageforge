import type { Font, Palette } from './types.js';

export interface StyleVars {
  /** e.g. "42rem" - theme default scaled by the user's width choice. */
  pageMax: string;
  /** 1 = normal; multiplies the base fluid type scale. */
  textFactor: number;
  /** "50%" | "16px" | "0" from the effective photo shape. */
  photoRadius: string;
  /** Spacing multiplier: compact 0.7, normal 1, airy 1.35. */
  density: number;
  /** Corner radius for user-picked section surfaces. */
  sectionRadius: string;
  /** Box shadow for user-picked section surfaces. */
  sectionShadow: string;
}

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
  font-size: calc(clamp(1rem, 0.95rem + 0.3vw, 1.125rem) * var(--text-factor));
}
img { display: block; max-width: 100%; }
h1, h2, h3 { font-family: var(--font-heading); line-height: 1.2; overflow-wrap: break-word; }
h1 { font-size: calc(clamp(1.9rem, 1.4rem + 2.5vw, 3rem) * var(--text-factor)); }
h2 { font-size: calc(clamp(1.25rem, 1.1rem + 0.8vw, 1.6rem) * var(--text-factor)); }

.page { max-width: var(--page-max); }
p, li { overflow-wrap: break-word; }
a { color: var(--accent); }
a:hover { text-decoration-thickness: 2px; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.hero .photo { object-fit: cover; border-radius: var(--photo-radius); }

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

.section { margin-top: calc(2.5rem * var(--density)); }
/* user-picked section surfaces (body class set only when the user overrides the theme's own) */
.surface-card .section, .surface-tinted .section, .surface-bordered .section {
  background: var(--surface);
  border: none;
  padding: calc(1.4rem * var(--density));
  border-radius: var(--section-radius);
  box-shadow: var(--section-shadow);
}
.surface-tinted .section { background: color-mix(in srgb, var(--accent) 7%, var(--bg)); }
.surface-bordered .section { border: 1px solid color-mix(in srgb, var(--muted) 40%, transparent); box-shadow: none; }
.surface-flat .section {
  background: none;
  border: none;
  padding: 0;
  box-shadow: none;
  border-bottom: none;
}
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

.gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
  gap: 0.6rem;
  padding: 0;
  list-style: none;
}
.gallery img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; }

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

/**
 * Palette + font + style choices become CSS custom properties on :root.
 * Everything the Style step controls lives here, so user choices always win
 * by construction - themes consume the vars instead of hardcoding values.
 */
export function rootVars(palette: Palette, font: Font, style: StyleVars): string {
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
  --page-max: ${style.pageMax};
  --text-factor: ${style.textFactor};
  --photo-radius: ${style.photoRadius};
  --density: ${style.density};
  --section-radius: ${style.sectionRadius};
  --section-shadow: ${style.sectionShadow};
}
`;
}
