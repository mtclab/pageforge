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
 * survive; anything else returns null and the caller renders plain text.
 */
export function safeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
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
