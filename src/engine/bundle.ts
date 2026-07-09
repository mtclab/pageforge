import { strToU8, zipSync } from 'fflate';
import { renderFavicon } from './favicon.js';
import { renderReadme } from './readme.js';
import { effectivePalette, renderSite, resolveFont } from './render.js';
import { collectImages, FAVICON_PATH, type SiteData, type ThemePack } from './types.js';

/** Fixed timestamp for zip entries: same inputs -> byte-identical zip. */
const ZIP_MTIME = new Date('2026-01-01T00:00:00Z');

function dataUrlBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Every file that goes into the downloaded site, keyed by zip path. */
export function buildSiteFiles(data: SiteData, theme: ThemePack): Record<string, Uint8Array> {
  const { html, css } = renderSite(data, theme);
  const palette = effectivePalette(data, theme);
  const font = resolveFont(theme, data.meta.fontId);

  const files: Record<string, Uint8Array> = {
    'index.html': strToU8(html),
    'style.css': strToU8(css),
    'README.md': strToU8(renderReadme(data.name.trim(), Boolean(data.photo))),
    [FAVICON_PATH]: strToU8(renderFavicon(data.name, palette, font)),
    'site.json': strToU8(JSON.stringify(data, null, 2) + '\n'),
  };
  for (const [path, dataUrl] of collectImages(data)) {
    files[path] = dataUrlBytes(dataUrl);
  }
  return files;
}

export function buildZip(files: Record<string, Uint8Array>): Uint8Array {
  return zipSync(files, { mtime: ZIP_MTIME, level: 6 });
}

/** "Anna Virtanen!" -> "anna-virtanen" (for the zip filename). */
export function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'my';
}

export function zipFilename(name: string): string {
  return `${slugify(name)}-homepage.zip`;
}
