/** Escape for HTML text nodes. */
export function esc(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/** Escape for HTML attribute values (always double-quote attributes). */
export function escAttr(s: string): string {
  return esc(s).replaceAll('"', '&quot;');
}

/**
 * A scheme-less input that is an email address and not a host: one @, a dotted
 * domain with a real TLD, no slash or whitespace anywhere. An optional ?query
 * is kept so `me@example.com?subject=Hello` still works.
 *
 * The links field asks for "a link (Instagram, email, anything)", so people type
 * their address bare. Without this test `https://` was prepended, making the
 * address the userinfo of a host: `me@example.com` became a link to
 * example.com, drawn with the globe icon, with the address sitting in the href
 * as plain text for any harvester - the exact thing the mailto path exists to
 * prevent.
 */
const BARE_EMAIL_RE = /^[^\s@/\\]+@[^\s@/\\]+\.[a-zA-Z]{2,}(\?[^\s]*)?$/;

/**
 * Normalize and validate a user-supplied URL.
 * A scheme-less email address becomes mailto:; anything else scheme-less gets
 * https:// prepended. Only http, https and mailto survive; anything else
 * returns null and the caller renders plain text.
 */
export function safeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
    ? trimmed
    : BARE_EMAIL_RE.test(trimmed)
      ? `mailto:${trimmed}`
      : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:' && url.protocol !== 'mailto:') {
    return null;
  }
  return url.href;
}

/**
 * Every character as a numeric HTML entity. Renders identically but keeps
 * plain-text email harvesters from scraping addresses off generated pages.
 */
export function entityEncode(s: string): string {
  return [...s].map((ch) => `&#${ch.codePointAt(0)};`).join('');
}

/**
 * Free text -> paragraphs. Escapes first, then blank lines split <p> blocks
 * and single newlines become <br>. No markdown in v1.
 */
export function textToHtml(text: string): string {
  const escaped = esc(text.replaceAll('\r\n', '\n').trim());
  if (!escaped) return '';
  return escaped
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replaceAll('\n', '<br>')}</p>`)
    .join('\n');
}
