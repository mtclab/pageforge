import { TEL_URL_RE } from './escape.js';
import type { SiteData } from './types.js';

export interface PostalAddressJsonLd {
  '@type': 'PostalAddress';
  streetAddress?: string;
  postalCode?: string;
  addressLocality?: string;
}

export interface OpeningHoursJsonLd {
  '@type': 'OpeningHoursSpecification';
  dayOfWeek: string | string[];
  opens: string;
  closes: string;
}

/** schema.org requires Monday..Sunday enum names, so FI/EN/SV labels and
 * ranges ("Ma-Pe") are mapped and expanded; unmappable labels are skipped. */
const SCHEMA_DAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
] as const;

const DAY_TOKENS: Record<string, number> = {
  ma: 0, maanantai: 0, mon: 0, monday: 0, 'må': 0, 'mån': 0, 'måndag': 0,
  ti: 1, tiistai: 1, tue: 1, tuesday: 1, tis: 1, tisdag: 1,
  ke: 2, keskiviikko: 2, wed: 2, wednesday: 2, ons: 2, onsdag: 2,
  to: 3, torstai: 3, thu: 3, thursday: 3, tor: 3, tors: 3, torsdag: 3,
  pe: 4, perjantai: 4, fri: 4, friday: 4, fre: 4, fredag: 4,
  la: 5, lauantai: 5, sat: 5, saturday: 5, 'lö': 5, 'lör': 5, 'lördag': 5,
  su: 6, sunnuntai: 6, sun: 6, sunday: 6, 'sö': 6, 'sön': 6, 'söndag': 6,
};

/** Expand a day label ("Ma", "Ma-Pe", "La, Su") to schema.org day names. */
export function schemaDaysForLabel(label: string): string[] {
  const days = new Set<number>();
  for (const part of label.split(',')) {
    const range = part.split(/[-–]/).map((token) => token.trim().toLocaleLowerCase('fi'));
    if (range.length === 1) {
      const day = DAY_TOKENS[range[0]!];
      if (day !== undefined) days.add(day);
    } else if (range.length === 2) {
      const from = DAY_TOKENS[range[0]!];
      const to = DAY_TOKENS[range[1]!];
      if (from === undefined || to === undefined) continue;
      for (let day = from; ; day = (day + 1) % 7) {
        days.add(day);
        if (day === to) break;
      }
    }
  }
  return [...days].sort((a, b) => a - b).map((day) => SCHEMA_DAYS[day]!);
}

export interface LocalBusinessJsonLd {
  '@context': 'https://schema.org';
  '@type': 'LocalBusiness';
  name: string;
  description?: string;
  telephone?: string;
  address?: PostalAddressJsonLd;
  openingHoursSpecification?: OpeningHoursJsonLd[];
}

/** Convert an HH, HH:MM, or Finnish HH.MM value to zero-padded HH:MM form. */
export function jsonLdTime(value: string | undefined): string | null {
  const match = value?.trim().match(/^(\d{1,2})(?:[:.](\d{2}))?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? '0');
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Parse the common Finnish "street, 00100 locality" address shape. */
export function jsonLdAddress(value: string | undefined): PostalAddressJsonLd | null {
  const address = value?.trim();
  if (!address) return null;
  const normalized = address.replaceAll('\r\n', '\n');
  const locality = normalized.match(/(?:^|[,\n]\s*)(\d{5})\s+([^,\n]+)(?:[,\n]|$)/);
  if (!locality) return { '@type': 'PostalAddress', streetAddress: normalized };

  const streetAddress = normalized
    .slice(0, locality.index)
    .replace(/[,\s]+$/, '')
    .trim();
  const result: PostalAddressJsonLd = {
    '@type': 'PostalAddress',
    ...(streetAddress ? { streetAddress } : {}),
    postalCode: locality[1]!,
    addressLocality: locality[2]!.trim(),
  };
  return result;
}

/** Build a schema.org LocalBusiness object, or null when it has only a name. */
export function localBusinessJsonLd(data: SiteData): LocalBusinessJsonLd | null {
  const name = data.name.trim();
  if (!name) return null;

  const description = data.tagline?.trim();
  const phoneLink = data.links.find((link) => TEL_URL_RE.test(link.url.trim()));
  const telephone = phoneLink?.url.trim().slice('tel:'.length);
  const location = data.sections.find(
    (section): section is Extract<SiteData['sections'][number], { kind: 'location' }> =>
      section.kind === 'location' && Boolean(section.address?.trim()),
  );
  const address = jsonLdAddress(location?.address);

  const openingHoursSpecification = data.sections.flatMap((section): OpeningHoursJsonLd[] => {
    if (section.kind !== 'hours') return [];
    return section.days.flatMap((day): OpeningHoursJsonLd[] => {
      if (day.closed || !day.label.trim()) return [];
      const opens = jsonLdTime(day.open);
      const closes = jsonLdTime(day.close);
      if (!opens || !closes) return [];
      const dayOfWeek = schemaDaysForLabel(day.label);
      if (!dayOfWeek.length) return [];
      return [{
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: dayOfWeek.length === 1 ? dayOfWeek[0]! : dayOfWeek,
        opens,
        closes,
      }];
    });
  });

  const result: LocalBusinessJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name,
    ...(description ? { description } : {}),
    ...(telephone ? { telephone } : {}),
    ...(address ? { address } : {}),
    ...(openingHoursSpecification.length ? { openingHoursSpecification } : {}),
  };
  return description || telephone || address || openingHoursSpecification.length ? result : null;
}

/** Safe inline JSON-LD script. Literal '<' never appears in the JSON payload. */
export function renderLocalBusinessJsonLd(data: SiteData): string {
  const jsonLd = localBusinessJsonLd(data);
  if (!jsonLd) return '';
  const json = JSON.stringify(jsonLd).replaceAll('<', '\\u003c');
  return `<script type="application/ld+json">${json}</script>`;
}
