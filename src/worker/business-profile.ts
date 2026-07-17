import { TEL_URL_RE } from '../engine/escape.js';
import { jsonLdTime } from '../engine/jsonld.js';
import type { LinkKind, Section } from '../engine/types.js';

export type ProvenanceSource = 'prh' | 'places' | 'owner' | 'operator';

export interface ProvenanceEntry {
  source: ProvenanceSource;
  at: number;
}

export interface BusinessProfileItem {
  name: string;
  price?: string;
  desc?: string;
  group?: string;
}

export type BusinessHoursDay = Extract<Section, { kind: 'hours' }>['days'][number];
export type BusinessHoursException = NonNullable<Extract<Section, { kind: 'hours' }>['exceptions']>[number];

export interface BusinessProfile {
  identity: {
    name: string;
    yTunnus?: string;
    vertical?: { code: string; label: string };
  };
  contact: {
    phone?: string;
    email?: string;
    address?: { street: string; postal: string; city: string };
  };
  hours: BusinessHoursDay[];
  exceptions?: BusinessHoursException[];
  services: BusinessProfileItem[];
  menu: BusinessProfileItem[];
  about?: string;
  tagline?: string;
  photos: { src: string }[];
  links: { label: string; url: string; kind?: LinkKind }[];
  provenance: Record<string, ProvenanceEntry>;
  consent: { photos?: boolean; texts?: boolean; note?: string };
}

export interface ProspectFacts {
  name: string;
  yTunnus?: string;
  vertical?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export const BUSINESS_PROFILE_LIMITS = {
  hours: 14,
  exceptions: 10,
  services: 20,
  menu: 20,
  photos: 6,
  links: 20,
} as const;

const PHOTO_SRC_RE = /^\/img\/[a-f0-9]{64}$/;
const PHONE_CHARS_RE = /^\+?[0-9][0-9 ()/.\-]*$/;
const PRICE_RE = /^(?:alkaen\s+)?\d{1,6}(?:[,.]\d{1,2})?\s*(?:€|eur)?$/i;
const SOURCES: readonly ProvenanceSource[] = ['prh', 'places', 'owner', 'operator'];

/** Finnish business-id checksum (mod-11). */
export function validateYTunnus(value: string): boolean {
  const match = value.match(/^(\d{7})-(\d)$/);
  if (!match) return false;
  const weights = [7, 9, 10, 5, 8, 4, 2];
  const sum = [...match[1]!].reduce(
    (total, digit, index) => total + Number(digit) * weights[index]!,
    0,
  );
  const remainder = sum % 11;
  if (remainder === 1) return false;
  const check = remainder === 0 ? 0 : 11 - remainder;
  return check === Number(match[2]);
}

export function validateFinnishPostalCode(value: string): boolean {
  return /^\d{5}$/.test(value);
}

export function validatePhone(value: string): boolean {
  if (!PHONE_CHARS_RE.test(value)) return false;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 5 && digits.length <= 15;
}

export function validateHttpsUrl(value: string): boolean {
  if (value.length > 500) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function validatePrice(value: string): boolean {
  return value.length <= 100 && PRICE_RE.test(value);
}

/** Pure, single-point hard validation for BusinessProfile v1. */
export function validateBusinessProfile(profile: BusinessProfile): string[] {
  const errors: string[] = [];
  if (!profile?.identity?.name?.trim()) errors.push('Nimi vaaditaan.');
  else if (profile.identity.name.length > 120) errors.push('Nimi on liian pitkä.');
  if (profile.identity.yTunnus && !validateYTunnus(profile.identity.yTunnus)) {
    errors.push('Y-tunnus ei läpäise tarkistusnumeroa.');
  }
  if (profile.contact.phone && !validatePhone(profile.contact.phone)) {
    errors.push('Puhelinnumero on virheellinen.');
  }
  if (profile.contact.address?.postal && !validateFinnishPostalCode(profile.contact.address.postal)) {
    errors.push('Postinumeron pitää olla viisi numeroa.');
  }
  if (profile.contact.address && (
    !profile.contact.address.street.trim()
    || !profile.contact.address.postal.trim()
    || !profile.contact.address.city.trim()
  )) {
    errors.push('Osoitteeseen tarvitaan katu, postinumero ja kaupunki.');
  }
  if (profile.hours.length > BUSINESS_PROFILE_LIMITS.hours) errors.push('Aukiolorivejä on liikaa.');
  const dayLabels = new Set<string>();
  for (const [index, day] of profile.hours.entries()) {
    const label = day.label.trim().toLocaleLowerCase('fi');
    if (!label) errors.push(`Aukiolorivin ${index + 1} päivä vaaditaan.`);
    else if (dayLabels.has(label)) errors.push(`Päivä ${day.label} esiintyy useammin kuin kerran.`);
    else dayLabels.add(label);
    if (day.closed) continue;
    if (!day.open || !day.close) {
      errors.push(`Aukiolorivillä ${index + 1} tarvitaan avaus- ja sulkemisaika.`);
      continue;
    }
    const open = jsonLdTime(day.open);
    const close = jsonLdTime(day.close);
    if (!open || !close) errors.push(`Aukiolorivin ${index + 1} kellonaika on virheellinen.`);
    else if (open === close) errors.push('Avaus- ja sulkemisaika eivät voi olla samat.');
  }
  if ((profile.exceptions?.length ?? 0) > BUSINESS_PROFILE_LIMITS.exceptions) {
    errors.push('Poikkeusaukioloja on liikaa.');
  }
  for (const [index, exception] of (profile.exceptions ?? []).entries()) {
    if (!exception.date.trim() || !exception.text.trim()) {
      errors.push(`Poikkeusaukiolorivillä ${index + 1} tarvitaan päivä ja teksti.`);
    }
    if (exception.date.length > 50 || exception.text.length > 300) {
      errors.push(`Poikkeusaukiolorivi ${index + 1} on liian pitkä.`);
    }
  }
  for (const [label, items, limit] of [
    ['Palveluita', profile.services, BUSINESS_PROFILE_LIMITS.services],
    ['Ruokalajeja', profile.menu, BUSINESS_PROFILE_LIMITS.menu],
  ] as const) {
    if (items.length > limit) errors.push(`${label} on liikaa.`);
    for (const [index, item] of items.entries()) {
      if (!item.name.trim()) errors.push(`${label} rivillä ${index + 1} nimi vaaditaan.`);
      if (item.name.length > 200 || (item.desc?.length ?? 0) > 2000) {
        errors.push(`${label} rivillä ${index + 1} on liian pitkä.`);
      }
      if ((item.group?.length ?? 0) > 60) {
        errors.push(`${label} rivillä ${index + 1} ryhmä on liian pitkä.`);
      }
      if (item.price && !validatePrice(item.price)) {
        errors.push(`${label} rivillä ${index + 1} hinta on virheellinen.`);
      }
    }
  }
  if (profile.photos.length > BUSINESS_PROFILE_LIMITS.photos) errors.push('Kuvia on liikaa.');
  for (const photo of profile.photos) {
    if (!PHOTO_SRC_RE.test(photo.src)) errors.push('Kuvan polun pitää olla muotoa /img/<sha256>.');
  }
  if (profile.links.length > BUSINESS_PROFILE_LIMITS.links) errors.push('Linkkejä on liikaa.');
  for (const [index, link] of profile.links.entries()) {
    if (!link.label.trim()) errors.push(`Linkin ${index + 1} nimi vaaditaan.`);
    // tel: links are first-class (they power the business call CTA).
    if (!validateHttpsUrl(link.url) && !TEL_URL_RE.test(link.url)) {
      errors.push(`Linkin ${index + 1} osoitteen pitää olla HTTPS-URL tai tel-numero.`);
    }
  }
  for (const [path, entry] of Object.entries(profile.provenance)) {
    if (!path || !entry || !SOURCES.includes(entry.source) || !Number.isFinite(entry.at) || entry.at <= 0) {
      errors.push('Provenienssitieto on virheellinen.');
      break;
    }
  }
  if ((profile.about?.length ?? 0) > 8000) errors.push('Esittelyteksti on liian pitkä.');
  if ((profile.tagline?.length ?? 0) > 300) errors.push('Iskulause on liian pitkä.');
  if ((profile.consent.note?.length ?? 0) > 2000) errors.push('Suostumushuomio on liian pitkä.');
  return errors;
}

/** Non-blocking internal and prospect/profile contradiction warnings. */
export function businessProfileWarnings(
  profile: BusinessProfile,
  prospect?: ProspectFacts,
): string[] {
  const warnings: string[] = [];
  for (const day of profile.hours) {
    if (day.closed && (day.open || day.close)) {
      warnings.push(`${day.label}: päivä on merkitty suljetuksi, mutta kellonaikoja on annettu.`);
    }
  }
  if (profile.photos.length && profile.consent.photos !== true) {
    warnings.push('Profiilissa on kuvia ilman vahvistettua kuvasuostumusta.');
  }
  const hasTexts = Boolean(
    profile.about || profile.tagline
      || profile.services.some((item) => item.desc)
      || profile.menu.some((item) => item.desc),
  );
  if (hasTexts && profile.consent.texts !== true) {
    warnings.push('Profiilissa on tekstejä ilman vahvistettua tekstisuostumusta.');
  }
  if (prospect) {
    const compare = (label: string, a?: string, b?: string): void => {
      if (a && b && a.trim().toLocaleLowerCase('fi') !== b.trim().toLocaleLowerCase('fi')) {
        warnings.push(`${label} poikkeaa prospektin tiedosta.`);
      }
    };
    compare('Nimi', profile.identity.name, prospect.name);
    compare('Y-tunnus', profile.identity.yTunnus, prospect.yTunnus);
    compare('Toimiala', profile.identity.vertical?.label, prospect.vertical);
    compare('Sähköposti', profile.contact.email, prospect.contactEmail);
    compare('Puhelin', profile.contact.phone, prospect.contactPhone);
  }
  return warnings;
}

export const validatePostalCode = validateFinnishPostalCode;
export const contradictionWarnings = businessProfileWarnings;
