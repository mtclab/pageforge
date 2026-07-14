import { effectivePalette, resolveFont } from '../engine/render.js';
import type { SiteData, ThemePack } from '../engine/types.js';

function graphemes(text: string): string[] {
  const Segmenter = (Intl as unknown as {
    Segmenter?: new (locale?: string, options?: { granularity: 'grapheme' }) => {
      segment(input: string): Iterable<{ segment: string }>;
    };
  }).Segmenter;
  if (!Segmenter) {
    const clusters: string[] = [];
    for (const part of Array.from(text)) {
      const previous = clusters[clusters.length - 1];
      const joinsPrevious = /\p{Mark}/u.test(part) || /[\ufe0e\ufe0f\u{1f3fb}-\u{1f3ff}]/u.test(part)
        || part === '\u200d' || previous?.endsWith('\u200d');
      if (previous && joinsPrevious) clusters[clusters.length - 1] += part;
      else clusters.push(part);
    }
    return clusters;
  }
  return [...new Segmenter(undefined, { granularity: 'grapheme' }).segment(text)]
    .map((part) => part.segment);
}

/** Wrap to two lines, then truncate without splitting a grapheme cluster. */
export function wrapOgName(name: string, measure: (text: string) => number, maxWidth: number): string[] {
  const parts = graphemes(name);
  const lines: string[] = [];
  let line = '';
  for (let i = 0; i < parts.length; i += 1) {
    const next = line + parts[i]!;
    if (!line || measure(next) <= maxWidth) {
      line = next;
      continue;
    }
    if (lines.length === 1) {
      while (line && measure(`${line}…`) > maxWidth) line = graphemes(line).slice(0, -1).join('');
      return [...lines, `${line.trimEnd()}…`];
    }
    lines.push(line.trimEnd());
    line = parts[i]!.trimStart();
  }
  if (line) lines.push(line.trimEnd());
  return lines;
}

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
  const nameLines = g.measureText(name).width > 1080
    ? wrapOgName(name, (text) => g.measureText(text).width, 1080)
    : [name];
  const nameY = nameLines.length > 1 ? 245 : 280;
  nameLines.forEach((line, i) => g.fillText(line, 60, nameY + i * 52));

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
