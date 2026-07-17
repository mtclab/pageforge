import { esc, escAttr, TEL_URL_RE } from '../escape.js';
import { renderLinks } from '../links.js';
import { PHOTO_PATH, type SiteData } from '../types.js';

export function renderHero(data: SiteData, heroCta = false): string {
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
  if (heroCta) {
    const phone = data.links.find((link) => safePhoneUrl(link.url) !== null);
    if (phone) {
      const url = safePhoneUrl(phone.url)!;
      parts.push(`<a class="cta-call" href="${escAttr(url)}">${esc(phone.label.trim() || 'Soita')}</a>`);
    }
  }
  const links = renderLinks(data.links);
  if (links) parts.push(links);
  return `<header class="hero">\n${parts.join('\n')}\n</header>`;
}

function safePhoneUrl(url: string): string | null {
  const trimmed = url.trim();
  return TEL_URL_RE.test(trimmed) ? trimmed : null;
}
