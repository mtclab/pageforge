/** Build a TEL_URL_RE-compatible href from an intake-valid Finnish phone number. */
export function telHref(phone: string): string {
  const normalized = phone.trim().replace(/[/.]/g, '').replace(/\s+/g, ' ');
  return `tel:${normalized}`;
}
