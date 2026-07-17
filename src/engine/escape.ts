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
 * Normalize and validate a user-supplied URL.
 * Scheme-less input gets https:// prepended. Only http, https and mailto
 * and valid tel links survive; anything else returns null and the caller
 * renders plain text.
 */
export function safeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (TEL_URL_RE.test(trimmed)) return trimmed;
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
    ? trimmed
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

export const TEL_URL_RE = /^tel:\+?[0-9 ()-]{5,20}$/;

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
