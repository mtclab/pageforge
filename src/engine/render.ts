import { BASE_CSS, rootVars } from './css.js';
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

/**
 * Pure composition: SiteData + ThemePack -> complete static site.
 * No DOM, no clock, no randomness - same inputs give byte-identical output.
 */
export function renderSite(data: SiteData, theme: ThemePack): RenderedSite {
  const palette = resolvePalette(theme, data.meta.paletteId);
  const font = resolveFont(theme, data.meta.fontId);

  const css = `${rootVars(palette, font)}\n${BASE_CSS}\n${theme.css}`;

  const name = data.name.trim();
  const sections = data.sections
    .map((s, i) => renderSection(s, i + 1))
    .filter(Boolean);

  const description = data.tagline?.trim();
  const bodyClass = `layout-${theme.layout} photo-${theme.photoShape}${data.photo ? ' has-photo' : ''}`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)}</title>
${description ? `<meta name="description" content="${escAttr(description)}">\n` : ''}<link rel="icon" href="${FAVICON_PATH}" type="image/svg+xml">
<link rel="stylesheet" href="style.css">
</head>
<body class="${bodyClass}">
<div class="page">
${renderHero(data)}
${sections.length ? `<main>\n${sections.join('\n')}\n</main>` : '<main></main>'}
${renderFooter(data)}
</div>
</body>
</html>
`;

  return { html, css };
}
