import { effectivePalette, resolveFont } from '../engine/render.js';
import type { SiteData, ThemePack } from '../engine/types.js';

/**
 * 1200x630 social-share card rendered on a canvas: palette background,
 * name huge, tagline under it, accent bar. Used by hosted publish (where
 * the final URL is known so og:image can point at it).
 */
export function renderOgCard(data: SiteData, theme: ThemePack): string {
  const palette = effectivePalette(data, theme);
  const font = resolveFont(theme, data.meta.fontId);
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  const g = canvas.getContext('2d')!;

  g.fillStyle = palette.vars.bg;
  g.fillRect(0, 0, 1200, 630);
  g.fillStyle = palette.vars.accent;
  g.fillRect(0, 0, 1200, 14);

  const heading = (font.headingStack ?? font.stack).replaceAll('"', "'");
  g.fillStyle = palette.vars.text;
  g.textBaseline = 'middle';

  const name = data.name.trim();
  let size = 92;
  g.font = `700 ${size}px ${heading}`;
  while (g.measureText(name).width > 1080 && size > 36) {
    size -= 4;
    g.font = `700 ${size}px ${heading}`;
  }
  g.fillText(name, 60, 280);

  const tagline = data.tagline?.trim();
  if (tagline) {
    g.fillStyle = palette.vars.muted;
    g.font = `400 40px ${font.stack.replaceAll('"', "'")}`;
    let shown = tagline;
    while (g.measureText(shown).width > 1080 && shown.length > 3) {
      shown = `${shown.slice(0, -4)}...`;
    }
    g.fillText(shown, 62, 370);
  }

  g.fillStyle = palette.vars.accent;
  g.fillRect(60, 440, 120, 8);

  return canvas.toDataURL('image/png');
}
