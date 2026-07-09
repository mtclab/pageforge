import { esc } from './escape.js';
import type { Font, Palette } from './types.js';

/** First letters of the first two words, uppercased. "Anna Virtanen" -> "AV". */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => [...w][0]?.toUpperCase() ?? '')
    .join('');
}

export function renderFavicon(name: string, palette: Palette, font: Font): string {
  const letters = initials(name) || '?';
  const size = letters.length > 1 ? 30 : 38;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="${palette.vars.accent}"/>
<text x="32" y="33" text-anchor="middle" dominant-baseline="central" font-family="${(font.headingStack ?? font.stack).replaceAll('"', "'")}" font-size="${size}" font-weight="700" fill="${palette.vars['accent-contrast']}">${esc(letters)}</text>
</svg>
`;
}
