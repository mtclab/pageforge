import { TEL_URL_RE } from '../engine/escape.js';
import { telHref } from '../engine/phone.js';
import type { Section, SiteData } from '../engine/types.js';
import { BUSINESS_LABELS } from '../engine/localization.js';
import { THEMES } from '../themes/index.js';
import type { BusinessProfile } from './business-profile.js';
import { structureProfileFor, type StructureSectionKind } from './structure-profiles.js';

export const THEME_FAMILIES = [
  { id: 'kyltti', themeIds: ['kyltti'] },
  { id: 'ruutu', themeIds: ['ruutu'] },
  { id: 'pehmo', themeIds: ['pehmo'] },
  { id: 'yo', themeIds: ['yo'] },
  { id: 'arkki', themeIds: ['arkki'] },
] as const;

function seedHash(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: string): () => number {
  let state = seedHash(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function addressText(profile: BusinessProfile): string | undefined {
  const address = profile.contact.address;
  if (!address) return undefined;
  const locality = [address.postal, address.city].filter(Boolean).join(' ');
  return [address.street, locality].filter(Boolean).join(', ') || undefined;
}

function sectionFor(kind: StructureSectionKind, profile: BusinessProfile): Section | null {
  switch (kind) {
    case 'about':
      return profile.about ? { kind: 'about', text: profile.about } : null;
    case 'hours':
      return profile.hours.length ? { kind: 'hours', days: profile.hours } : null;
    case 'services':
      return profile.services.length ? { kind: 'services', items: profile.services } : null;
    case 'menu':
      return profile.menu.length
        ? { kind: 'services', title: BUSINESS_LABELS.fi.menu, items: profile.menu }
        : null;
    case 'gallery':
      return profile.photos.length
        ? { kind: 'gallery', title: BUSINESS_LABELS.fi.gallery, photos: profile.photos }
        : null;
    case 'location': {
      const address = addressText(profile);
      return address || profile.contact.phone
        ? {
            kind: 'location',
            ...(address === undefined ? {} : { address }),
            ...(profile.contact.phone === undefined ? {} : { phone: profile.contact.phone }),
          }
        : null;
    }
    case 'contact':
      return profile.contact.email ? { kind: 'contact', email: profile.contact.email } : null;
  }
}

function contentFor(profile: BusinessProfile): Omit<SiteData, 'meta'> {
  const structure = structureProfileFor(
    profile.identity.vertical?.code,
    profile.identity.vertical?.label,
  );
  const sections = structure.sections
    .map((kind) => sectionFor(kind, profile))
    .filter((section): section is Section => section !== null);
  const capabilities: NonNullable<SiteData['capabilities']> = {};
  for (const section of sections) {
    if (section.kind === 'hours') capabilities.hours = true;
    if (section.kind === 'services') capabilities.services = true;
    if (section.kind === 'gallery') capabilities.gallery = true;
    if (section.kind === 'location') capabilities.location = true;
    if (section.kind === 'contact') capabilities.contact = true;
  }
  const address = addressText(profile);
  const hasBusiness = Boolean(profile.contact.phone || address || profile.identity.yTunnus);
  // The call CTA renders the first tel: link; derive one from the contact
  // phone so the operator never has to type the number twice.
  const telUrl = profile.contact.phone ? telHref(profile.contact.phone) : undefined;
  const links = telUrl && TEL_URL_RE.test(telUrl)
    && !profile.links.some((link) => link.url.startsWith('tel:'))
    ? [{ label: 'Soita', url: telUrl, kind: 'phone' as const }, ...profile.links]
    : profile.links;
  return {
    version: 1,
    name: profile.identity.name,
    lang: 'fi',
    ...(profile.tagline === undefined ? {} : { tagline: profile.tagline }),
    ...(profile.photos[0] === undefined ? {} : { photo: profile.photos[0] }),
    links,
    sections,
    ...(hasBusiness
      ? {
          business: {
            ...(profile.contact.phone === undefined ? {} : { phone: profile.contact.phone }),
            ...(address === undefined ? {} : { address }),
            ...(profile.contact.address?.city === undefined ? {} : { city: profile.contact.address.city }),
            ...(profile.identity.yTunnus === undefined ? {} : { yTunnus: profile.identity.yTunnus }),
          },
        }
      : {}),
    ...(Object.keys(capabilities).length ? { capabilities } : {}),
  };
}

/** The family lookup is exported so tests can enforce the hard-deck spread. */
export function themeFamilyForTheme(themeId: string): string | undefined {
  return THEME_FAMILIES.find((family) => family.themeIds.some((id) => id === themeId))?.id;
}

/** Pure deterministic profile composer. Vertical input affects structure only. */
export function compose(profile: BusinessProfile, seed: string): SiteData[] {
  const random = seededRandom(seed);
  const families = [...THEME_FAMILIES];
  for (let index = families.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [families[index], families[swap]] = [families[swap]!, families[index]!];
  }
  const content = contentFor(profile);
  return families.slice(0, 3).map((family) => {
    const themeId = family.themeIds[Math.floor(random() * family.themeIds.length)]!;
    const theme = THEMES.find((candidate) => candidate.id === themeId)!;
    const paletteId = theme.palettes[Math.floor(random() * theme.palettes.length)]!.id;
    return {
      ...content,
      meta: { themeId, paletteId, fontId: theme.defaults.fontId },
    };
  });
}
