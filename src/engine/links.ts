import { entityEncode, escAttr, esc, safeUrl } from './escape.js';
import type { Link, LinkKind } from './types.js';

/** Guess the platform from a URL so we can show the right icon. */
export function detectKind(url: string): LinkKind {
  const normalized = safeUrl(url);
  if (!normalized) return 'website';
  if (normalized.startsWith('mailto:')) return 'email';
  let host: string;
  try {
    host = new URL(normalized).hostname.replace(/^www\./, '');
  } catch {
    return 'website';
  }
  if (host === 'github.com' || host.endsWith('.github.com')) return 'github';
  if (host === 'instagram.com') return 'instagram';
  if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) return 'linkedin';
  if (host === 'youtube.com' || host === 'youtu.be') return 'youtube';
  if (host === 'facebook.com' || host === 'fb.com') return 'facebook';
  if (host === 'x.com' || host === 'twitter.com') return 'x';
  return 'website';
}

/* Minimal single-path glyphs, 24x24 viewBox, filled with currentColor. */
const ICON_PATHS: Record<LinkKind, string> = {
  email:
    'M2 5v14h20V5H2zm18 2v.4l-8 5.3-8-5.3V7h16zM4 17V9.8l8 5.3 8-5.3V17H4z',
  github:
    'M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.2-3.4-1.2-.4-1.1-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.2-.4-1.2.1-2.6 0 0 .8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.6.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9v2.7c0 .3.2.6.7.5A10 10 0 0 0 12 2z',
  instagram:
    'M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 0 1 12 7.5zm0 2A2.5 2.5 0 1 0 14.5 12 2.5 2.5 0 0 0 12 9.5zM17.5 5.5a1 1 0 1 1-1 1 1 1 0 0 1 1-1z',
  linkedin:
    'M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3V9zm7 0h3.8v1.7h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6V21h-4v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9V21h-4V9z',
  youtube:
    'M23 7.2s-.2-1.6-.9-2.3c-.9-.9-1.9-.9-2.3-1C16.6 3.6 12 3.6 12 3.6s-4.6 0-7.8.3c-.4.1-1.4.1-2.3 1-.7.7-.9 2.3-.9 2.3S.8 9.1.8 11v1.8c0 1.9.2 3.8.2 3.8s.2 1.6.9 2.3c.9.9 2 .9 2.5 1 1.8.2 7.6.3 7.6.3s4.6 0 7.8-.4c.4 0 1.4-.1 2.3-1 .7-.7.9-2.3.9-2.3s.2-1.9.2-3.7V11c0-1.9-.2-3.8-.2-3.8zM9.8 15.1V8.7l6.2 3.2-6.2 3.2z',
  facebook:
    'M13.5 21v-8h2.7l.4-3h-3.1V8c0-.9.3-1.5 1.6-1.5h1.6V3.9c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.1H7.6v3h2.7v8h3.2z',
  x: 'M17.7 3h3l-6.6 7.6L22 21h-6.1l-4.8-6.3L5.6 21h-3l7.1-8.1L2 3h6.3l4.3 5.7L17.7 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11 14.5z',
  website:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm7.9 9h-3.4a15.6 15.6 0 0 0-1.2-5.7A8 8 0 0 1 19.9 11zM12 4.1c.9 1.1 2 3.3 2.4 6.9H9.6c.3-3.6 1.5-5.8 2.4-6.9zM8.7 5.3A15.6 15.6 0 0 0 7.5 11H4.1a8 8 0 0 1 4.6-5.7zM4.1 13h3.4c.1 2.2.6 4.1 1.2 5.7A8 8 0 0 1 4.1 13zm5.5 0h4.8c-.3 3.6-1.5 5.8-2.4 6.9-.9-1.1-2-3.3-2.4-6.9zm5.7 5.7c.6-1.6 1-3.5 1.2-5.7h3.4a8 8 0 0 1-4.6 5.7z',
};

export function iconSvg(kind: LinkKind): string {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON_PATHS[kind]}"/></svg>`;
}

/** Render the links strip. Links whose URL fails validation render as plain text. */
export function renderLinks(links: Link[]): string {
  const items = links
    .filter((l) => l.label.trim() || l.url.trim())
    .map((link) => {
      const url = safeUrl(link.url);
      const kind = link.kind ?? detectKind(link.url);
      const label = esc(link.label.trim() || link.url.trim());
      if (!url) return `<span>${label}</span>`;
      // mailto targets are entity-encoded against address scrapers
      const href = url.startsWith('mailto:') ? entityEncode(url) : escAttr(url);
      return `<a href="${href}">${iconSvg(kind)}<span>${label}</span></a>`;
    });
  if (!items.length) return '';
  return `<nav class="links" aria-label="Links">\n${items.join('\n')}\n</nav>`;
}
