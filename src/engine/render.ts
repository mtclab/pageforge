import { accentContrastFor, fitAccent } from './color.js';
import { BASE_CSS, rootVars, type StyleVars } from './css.js';
import { escAttr, esc } from './escape.js';
import { renderSection } from './sections/blocks.js';
import { renderFooter } from './sections/footer.js';
import { renderHero } from './sections/hero.js';
import {
  FAVICON_PATH,
  type Font,
  type Palette,
  type RenderedSite,
  type SiteData,
  type ThemePack,
} from './types.js';

export function resolvePalette(theme: ThemePack, paletteId: string): Palette {
  return theme.palettes.find((p) => p.id === paletteId)
    ?? theme.palettes.find((p) => p.id === theme.defaults.paletteId)
    ?? theme.palettes[0]!;
}

export function resolveFont(theme: ThemePack, fontId: string): Font {
  return theme.fonts.find((f) => f.id === fontId)
    ?? theme.fonts.find((f) => f.id === theme.defaults.fontId)
    ?? theme.fonts[0]!;
}

/** Palette with the user's custom accent (contrast-fitted) applied - for favicon/og rendering. */
export function effectivePalette(data: SiteData, theme: ThemePack): Palette {
  const palette = resolvePalette(theme, data.meta.paletteId);
  if (!data.meta.accent) return palette;
  const fitted = fitAccent(data.meta.accent, palette.vars.bg);
  return {
    ...palette,
    vars: { ...palette.vars, accent: fitted, 'accent-contrast': accentContrastFor(fitted) },
  };
}

const WIDTH_SCALE = { narrow: 0.85, normal: 1, wide: 1.25 } as const;
const TEXT_FACTOR = { s: 0.92, m: 1, l: 1.12 } as const;
const PHOTO_RADIUS = { circle: '50%', rounded: '16px', square: '0' } as const;
const DENSITY = { compact: 0.7, normal: 1, airy: 1.35 } as const;
const SECTION_RADIUS = { sharp: '0', soft: '12px', round: '22px' } as const;
const SECTION_SHADOW = {
  none: 'none',
  soft: '0 1px 3px rgba(0, 0, 0, 0.08)',
  lifted: '0 10px 28px -10px rgba(0, 0, 0, 0.28)',
} as const;

/**
 * Everything the Style step controls, resolved to CSS custom property
 * values. Width scales the THEME's natural content width so each theme
 * keeps its proportions; text factor multiplies the base fluid type scale.
 */
export function styleVars(data: SiteData, theme: ThemePack): StyleVars {
  const widthKey = data.meta.width ?? 'normal';
  const scale = WIDTH_SCALE[widthKey in WIDTH_SCALE ? widthKey : 'normal'];
  const baseRem = parseFloat(theme.pageMax);
  const pageMax = Number.isFinite(baseRem)
    ? `${Number((baseRem * scale).toFixed(2))}rem`
    : theme.pageMax;
  const scaleKey = data.meta.textScale ?? 'm';
  const shape = data.meta.photoShape ?? theme.photoShape;
  const densityKey = data.meta.density ?? 'normal';
  const cornersKey = data.meta.corners ?? 'soft';
  const shadowKey = data.meta.shadow ?? 'soft';
  return {
    pageMax,
    textFactor: TEXT_FACTOR[scaleKey in TEXT_FACTOR ? scaleKey : 'm'],
    photoRadius: PHOTO_RADIUS[shape in PHOTO_RADIUS ? shape : theme.photoShape],
    density: DENSITY[densityKey in DENSITY ? densityKey : 'normal'],
    sectionRadius: SECTION_RADIUS[cornersKey in SECTION_RADIUS ? cornersKey : 'soft'],
    sectionShadow: SECTION_SHADOW[shadowKey in SECTION_SHADOW ? shadowKey : 'soft'],
  };
}

export interface RenderOptions {
  /**
   * Absolute URL the site will live at (no trailing slash). When known
   * (hosted publish), enables og:image + canonical. Zip downloads omit it -
   * we cannot know where the user will host.
   */
  baseUrl?: string;
  /** Hosted pages get nofollow on user links + a host footer line. */
  hosted?: boolean;
}

/**
 * Pure composition: SiteData + ThemePack -> complete static site.
 * No DOM, no clock, no randomness - same inputs give byte-identical output.
 */
export function renderSite(data: SiteData, theme: ThemePack, opts: RenderOptions = {}): RenderedSite {
  const palette = effectivePalette(data, theme);
  const font = resolveFont(theme, data.meta.fontId);

  const css = `${rootVars(palette, font, styleVars(data, theme))}\n${BASE_CSS}\n${theme.css}`;

  const name = data.name.trim();
  const sections = data.sections
    .map((s, i) => renderSection(s, i + 1))
    .filter(Boolean);

  const description = data.tagline?.trim();
  const photoShape = data.meta.photoShape ?? theme.photoShape;
  const surfaceClass = data.meta.surface ? ` surface-${data.meta.surface}` : '';
  const bodyClass = `layout-${theme.layout} photo-${photoShape}${surfaceClass}${data.photo ? ' has-photo' : ''}`;

  const ogExtras = opts.baseUrl
    ? `<meta property="og:image" content="${escAttr(opts.baseUrl)}/assets/og.png">
<meta property="og:url" content="${escAttr(opts.baseUrl)}/">
<link rel="canonical" href="${escAttr(opts.baseUrl)}/">
`
    : '';

  let body = `${renderHero(data)}
${sections.length ? `<main>\n${sections.join('\n')}\n</main>` : '<main></main>'}
${renderFooter(data, opts.hosted)}`;

  if (opts.hosted) {
    // Hosted pages: outbound user links get nofollow (SEO-spam deterrent).
    const footerAt = body.lastIndexOf('<footer>');
    body =
      body.slice(0, footerAt).replaceAll('<a href="http', '<a rel="nofollow noopener" href="http') +
      body.slice(footerAt);
  }

  const lang = /^[a-z]{2,3}(-[a-zA-Z0-9-]{1,10})?$/.test(data.lang ?? '') ? data.lang! : 'en';
  const html = `<!doctype html>
<html lang="${escAttr(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)}</title>
${description ? `<meta name="description" content="${escAttr(description)}">\n` : ''}<meta property="og:title" content="${escAttr(name)}">
${description ? `<meta property="og:description" content="${escAttr(description)}">\n` : ''}<meta property="og:type" content="website">
${ogExtras}<link rel="icon" href="${FAVICON_PATH}" type="image/svg+xml">
<link rel="stylesheet" href="style.css">
</head>
<body class="${bodyClass}">
<div class="page">
${body}
</div>
</body>
</html>
`;

  return { html, css };
}
