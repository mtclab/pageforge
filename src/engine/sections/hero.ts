import { esc, escAttr } from '../escape.js';
import { renderLinks } from '../links.js';
import { PHOTO_PATH, type SiteData } from '../types.js';

export function renderHero(data: SiteData): string {
  const parts: string[] = [];
  if (data.photo) {
    // Inline `{ dataUrl }` photos are served at the bundled path; R2
    // `{ src: "/img/..." }` references are emitted verbatim (escaped).
    const src = 'src' in data.photo ? escAttr(data.photo.src) : PHOTO_PATH;
    parts.push(
      `<img class="photo" src="${src}" alt="${escAttr(data.name)}" width="512" height="512">`,
    );
  }
  parts.push(`<h1>${esc(data.name)}</h1>`);
  if (data.tagline?.trim()) {
    parts.push(`<p class="tagline">${esc(data.tagline.trim())}</p>`);
  }
  const links = renderLinks(data.links);
  if (links) parts.push(links);
  return `<header class="hero">\n${parts.join('\n')}\n</header>`;
}
