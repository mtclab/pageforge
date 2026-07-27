import { esc, escAttr } from '../escape.js';
import { renderLinks } from '../links.js';
import { labelContext, type LabelContext, PHOTO_PATH, type SiteData } from '../types.js';

export interface HeroRenderOptions {
  /** Labels for the page's language; built from the data when omitted. */
  ctx?: LabelContext;
}

export function renderHero(data: SiteData, opts: HeroRenderOptions = {}): string {
  const ctx = opts.ctx ?? labelContext(data);
  const parts: string[] = [];
  if (data.photo) {
    parts.push(
      `<img class="photo" src="${PHOTO_PATH}" alt="${escAttr(data.name)}" width="512" height="512">`,
    );
  }
  parts.push(`<h1>${esc(data.name)}</h1>`);
  if (data.tagline?.trim()) {
    parts.push(`<p class="tagline">${esc(data.tagline.trim())}</p>`);
  }
  const links = renderLinks(data.links, ctx.personal.email, ctx.labelLangAttr);
  if (links) parts.push(links);
  return `<header class="hero">\n${parts.join('\n')}\n</header>`;
}
