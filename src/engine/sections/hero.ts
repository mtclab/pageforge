import { esc, escAttr, TEL_URL_RE } from '../escape.js';
import { extractFoundingYear } from '../evidence.js';
import { renderLinks } from '../links.js';
import { PHOTO_PATH, type SiteData } from '../types.js';

export interface HeroRenderOptions {
  heroCta?: boolean;
  bizHero?: boolean;
}

function heroName(name: string, bizHero: boolean): string {
  if (!bizHero) return `<h1>${esc(name)}</h1>`;
  const words = name.split(/\s+/);
  const withInitial = (text: string): string => {
    const chars = [...text];
    const first = chars.shift();
    return first === undefined
      ? ''
      : `<span class="hero-initial">${esc(first)}</span>${esc(chars.join(''))}`;
  };
  if (name.length <= 12) {
    return `<h1 class="hero-one">${withInitial(name)}</h1>`;
  }
  if (words.length === 2) {
    return `<h1 class="hero-stack"><span class="hero-line">${withInitial(words[0]!)}</span><span class="hero-line">${esc(words[1]!)}</span></h1>`;
  }
  return `<h1>${withInitial(name)}</h1>`;
}

export function renderHero(data: SiteData, opts: HeroRenderOptions = {}): string {
  const parts: string[] = [];
  const name = data.name.trim();
  if (opts.bizHero && data.business?.city?.trim()) {
    parts.push(`<p class="eyebrow-locality">${esc(data.business.city.trim())}</p>`);
  }
  if (data.photo) {
    // Inline `{ dataUrl }` photos are served at the bundled path; R2
    // `{ src: "/img/..." }` references are emitted verbatim (escaped).
    const src = 'src' in data.photo ? escAttr(data.photo.src) : PHOTO_PATH;
    parts.push(
      `<img class="photo" src="${src}" alt="${escAttr(name)}" width="512" height="512">`,
    );
  }
  parts.push(heroName(name, opts.bizHero === true));
  if (opts.bizHero) {
    const about = data.sections.find((section) => section.kind === 'about');
    const year = extractFoundingYear(about?.text);
    if (year) parts.push(`<span class="badge-year">Vuodesta ${year}</span>`);
  }
  if (data.tagline?.trim()) {
    parts.push(`<p class="tagline">${esc(data.tagline.trim())}</p>`);
  }
  let stripLinks = data.links;
  if (opts.heroCta) {
    const phone = data.links.find((link) => safePhoneUrl(link.url) !== null);
    if (phone) {
      const url = safePhoneUrl(phone.url)!;
      parts.push(`<a class="cta-call" href="${escAttr(url)}">${esc(phone.label.trim() || 'Soita')}</a>`);
      // The CTA already renders this link - keep it out of the strip below.
      stripLinks = data.links.filter((link) => link !== phone);
    }
  }
  const links = renderLinks(stripLinks);
  if (links) parts.push(links);
  return `<header class="hero">\n${parts.join('\n')}\n</header>`;
}

function safePhoneUrl(url: string): string | null {
  const trimmed = url.trim();
  return TEL_URL_RE.test(trimmed) ? trimmed : null;
}
