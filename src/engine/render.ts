import { accentContrastFor, fitAccent, fitAccentFor, luminance } from './color.js';
import { BASE_CSS, rootVars, type StyleVars } from './css.js';
import { escAttr, esc } from './escape.js';
import { EMAIL_ACTIVATION_SCRIPT } from './links.js';
import { renderSection } from './sections/blocks.js';
import { renderFooter } from './sections/footer.js';
import { renderHero } from './sections/hero.js';
import {
  CUSTOM_FAVICON_PATH,
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

const HEX_RE = /^#[0-9a-f]{6}$/;

/**
 * The palette actually rendered: theme palette, or the user's fully custom
 * colors (theme designer), plus the custom accent - every user-supplied
 * pair contrast-guarded so an unreadable page cannot exist.
 */
export function effectivePalette(data: SiteData, theme: ThemePack): Palette {
  let palette = resolvePalette(theme, data.meta.paletteId);

  const cp = data.meta.customPalette;
  if (cp && [cp.bg, cp.surface, cp.text, cp.muted, cp.accent].every((c) => HEX_RE.test(c ?? ''))) {
    const bg = cp.bg;
    let surface = cp.surface;
    let text = fitAccentFor(cp.text, [bg, surface]);
    let muted = fitAccentFor(cp.muted, [bg, surface]);
    let accent = fitAccentFor(cp.accent, [bg, surface]);
    // Opposing backgrounds can make AA impossible for any one foreground.
    // In that case reject the custom surface and use the page background.
    if (!text || !muted || !accent) {
      surface = bg;
      text = fitAccent(cp.text, bg);
      muted = fitAccent(cp.muted, bg);
      accent = fitAccent(cp.accent, bg);
    }
    palette = {
      id: 'custom',
      name: 'Custom',
      vars: { bg, surface, text, muted, accent, 'accent-contrast': accentContrastFor(accent) },
    };
  }

  if (!data.meta.accent) return palette;
  const backgrounds = [palette.vars.bg, palette.vars.surface];
  const fitted = fitAccentFor(data.meta.accent, backgrounds)
    ?? fitAccentFor(palette.vars.accent, backgrounds)
    ?? palette.vars.accent;
  return {
    ...palette,
    vars: { ...palette.vars, accent: fitted, 'accent-contrast': accentContrastFor(fitted) },
  };
}

/**
 * The theme's darkest palette, if it has a genuinely dark one - used by the
 * auto dark mode option. Returns null when the theme has no dark palette.
 */
export function darkestPalette(theme: ThemePack): Palette | null {
  let best: Palette | null = null;
  let bestLum = 0.18;
  for (const p of theme.palettes) {
    const l = luminance(p.vars.bg);
    if (l < bestLum) {
      bestLum = l;
      best = p;
    }
  }
  return best;
}

/** Dark-mode :root override block, or '' when not applicable. */
function autoDarkCss(data: SiteData, theme: ThemePack, lightPalette: Palette): string {
  if (!data.meta.autoDark) return '';
  const dark = darkestPalette(theme);
  // Only meaningful when the visible palette is light and a distinct dark one exists.
  if (!dark || dark.id === lightPalette.id || luminance(lightPalette.vars.bg) < 0.4) return '';
  let accent = dark.vars.accent;
  let accentContrast = dark.vars['accent-contrast'];
  if (data.meta.accent) {
    accent = fitAccentFor(data.meta.accent, [dark.vars.bg, dark.vars.surface])
      ?? fitAccentFor(dark.vars.accent, [dark.vars.bg, dark.vars.surface])
      ?? dark.vars.accent;
    accentContrast = accentContrastFor(accent);
  }
  return `@media (prefers-color-scheme: dark) {
:root {
  --bg: ${dark.vars.bg};
  --surface: ${dark.vars.surface};
  --text: ${dark.vars.text};
  --muted: ${dark.vars.muted};
  --accent: ${accent};
  --accent-contrast: ${accentContrast};
}
}
`;
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
  /** Business wrappers may promote the first phone link in the hero. */
  heroCta?: boolean;
  /** Enable evidence-driven business hero and story markup. */
  bizHero?: boolean;
}

/**
 * Pure composition: SiteData + ThemePack -> complete static site.
 * No DOM, no clock, no randomness - same inputs give byte-identical output.
 */
export function renderSite(data: SiteData, theme: ThemePack, opts: RenderOptions = {}): RenderedSite {
  const palette = effectivePalette(data, theme);
  const font = resolveFont(theme, data.meta.fontId);

  const css = `${rootVars(palette, font, styleVars(data, theme))}\n${BASE_CSS}\n${theme.css}\n${autoDarkCss(data, theme, palette)}`;

  const name = data.name.trim();
  const sections = data.sections
    .map((s, i) => renderSection(s, i + 1, data.lang, data.business, opts.bizHero === true))
    .filter(Boolean);

  const description = data.tagline?.trim();
  const photoShape = data.meta.photoShape && ['circle', 'rounded', 'square'].includes(data.meta.photoShape)
    ? data.meta.photoShape
    : theme.photoShape;
  const flags: string[] = [`layout-${theme.layout}`, `photo-${photoShape}`];
  if (data.meta.surface && ['card', 'flat', 'bordered', 'tinted'].includes(data.meta.surface)) {
    flags.push(`surface-${data.meta.surface}`);
  }
  if (data.meta.headingStyle && ['underline', 'highlight', 'caps'].includes(data.meta.headingStyle)) {
    flags.push(`heading-${data.meta.headingStyle}`);
  }
  if (data.meta.heroAlign && ['left', 'center'].includes(data.meta.heroAlign)) {
    flags.push(`hero-${data.meta.heroAlign}`);
  }
  if (data.meta.photoSize && ['s', 'l'].includes(data.meta.photoSize)) {
    flags.push(`photo-sz-${data.meta.photoSize}`);
  }
  if (
    data.meta.background &&
    ['dots', 'grid', 'lines', 'wash-top', 'wash-corner'].includes(data.meta.background)
  ) {
    flags.push(`bg-${data.meta.background}`);
  }
  if (data.photo) flags.push('has-photo');
  const bodyClass = escAttr(flags.join(' '));

  const ogExtras = opts.baseUrl
    ? `<meta property="og:image" content="${escAttr(opts.baseUrl)}/assets/og.png">
<meta property="og:url" content="${escAttr(opts.baseUrl)}/">
<link rel="canonical" href="${escAttr(opts.baseUrl)}/">
`
    : '';

  let body = `${renderHero(data, { heroCta: opts.heroCta, bizHero: opts.bizHero })}
${sections.length ? `<main>\n${sections.join('\n')}\n</main>` : '<main></main>'}
${renderFooter(data, opts.hosted)}`;

  if (body.includes('data-email-a=')) body += `\n${EMAIL_ACTIVATION_SCRIPT}`;

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
${ogExtras}${
    data.favicon
      ? `<link rel="icon" href="${CUSTOM_FAVICON_PATH}" type="image/png">`
      : `<link rel="icon" href="${FAVICON_PATH}" type="image/svg+xml">`
  }
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
