/**
 * Extract a plausible founding year from Finnish business-story copy.
 * Kept deliberately narrow: this is evidence, not a guess from any number.
 */
export function extractFoundingYear(about?: string): string | null {
  if (!about) return null;
  const match = about.match(/vuodesta\s+(\d{4})/i)
    ?? about.match(/\b(?:est\.?|perustettu)\s*(\d{4})/i);
  if (!match) return null;
  const year = Number(match[1]);
  return year >= 1800 && year <= 2100 ? match[1]! : null;
}
