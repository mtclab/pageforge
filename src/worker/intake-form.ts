import type { LinkKind } from '../engine/types.js';
import {
  BUSINESS_PROFILE_LIMITS,
  type BusinessProfile,
  type BusinessProfileItem,
  type ProvenanceEntry,
} from './business-profile.js';
import type { Prospect } from './db.js';
import { optionalFormString } from './shared.js';

const LINK_KINDS: readonly LinkKind[] = [
  'email', 'github', 'instagram', 'linkedin', 'youtube', 'facebook', 'x', 'phone', 'website',
];

function optional(form: FormData, name: string): string | undefined {
  return optionalFormString(form, name);
}

/** Parse numbered zero-JS intake fields, ignoring parsed rows beyond the documented caps. */
export function parseBusinessProfileForm(
  form: FormData,
  prospect: Prospect,
  at = Date.now(),
): BusinessProfile {
  const provenance: Record<string, ProvenanceEntry> = {};
  const mark = (path: string): void => {
    provenance[path] = { source: 'operator', at };
  };

  const name = optional(form, 'name') ?? '';
  const yTunnus = optional(form, 'yTunnus');
  const verticalCode = optional(form, 'vertical_code');
  const verticalLabel = optional(form, 'vertical_label');
  if (name) mark('identity.name');
  if (yTunnus) mark('identity.yTunnus');
  if (verticalCode || verticalLabel) {
    mark('identity.vertical.code');
    mark('identity.vertical.label');
  }

  const phone = optional(form, 'phone');
  const email = optional(form, 'email');
  const street = optional(form, 'street');
  const postal = optional(form, 'postal');
  const city = optional(form, 'city');
  if (phone) mark('contact.phone');
  if (email) mark('contact.email');
  if (street || postal || city) {
    mark('contact.address.street');
    mark('contact.address.postal');
    mark('contact.address.city');
  }

  const hours: BusinessProfile['hours'] = [];
  for (let index = 0; index < BUSINESS_PROFILE_LIMITS.hours * 2; index++) {
    const label = optional(form, `hours_${index}_label`);
    const open = optional(form, `hours_${index}_open`);
    const close = optional(form, `hours_${index}_close`);
    const closed = form.has(`hours_${index}_closed`);
    if (!label && !open && !close && !closed) continue;
    const row = {
      label: label ?? '',
      ...(open === undefined ? {} : { open }),
      ...(close === undefined ? {} : { close }),
      ...(closed ? { closed: true } : {}),
    };
    hours.push(row);
    for (const key of Object.keys(row)) mark(`hours.${hours.length - 1}.${key}`);
    if (hours.length >= BUSINESS_PROFILE_LIMITS.hours) break;
  }

  const exceptions: NonNullable<BusinessProfile['exceptions']> = [];
  for (let index = 0; index < BUSINESS_PROFILE_LIMITS.exceptions * 2; index++) {
    const date = optional(form, `exceptions_${index}_date`);
    const text = optional(form, `exceptions_${index}_text`);
    if (!date && !text) continue;
    exceptions.push({ date: date ?? '', text: text ?? '' });
    mark(`exceptions.${exceptions.length - 1}.date`);
    mark(`exceptions.${exceptions.length - 1}.text`);
    if (exceptions.length >= BUSINESS_PROFILE_LIMITS.exceptions) break;
  }

  const parseItems = (prefix: 'services' | 'menu', limit: number): BusinessProfileItem[] => {
    const items: BusinessProfileItem[] = [];
    for (let index = 0; index < limit * 2; index++) {
      const itemName = optional(form, `${prefix}_${index}_name`);
      const price = optional(form, `${prefix}_${index}_price`);
      const desc = optional(form, `${prefix}_${index}_desc`);
      const group = optional(form, `${prefix}_${index}_group`);
      if (!itemName && !price && !desc && !group) continue;
      const item = {
        name: itemName ?? '',
        ...(price === undefined ? {} : { price }),
        ...(desc === undefined ? {} : { desc }),
        ...(group === undefined ? {} : { group }),
      };
      items.push(item);
      for (const key of Object.keys(item)) {
        mark(`${prefix}.${items.length - 1}.${key}`);
      }
      if (items.length >= limit) break;
    }
    return items;
  };

  const about = optional(form, 'about');
  const tagline = optional(form, 'tagline');
  if (about) mark('about');
  if (tagline) mark('tagline');

  const photos: BusinessProfile['photos'] = [];
  for (let index = 0; index < BUSINESS_PROFILE_LIMITS.photos * 2; index++) {
    const src = optional(form, `photos_${index}_src`);
    if (!src) continue;
    photos.push({ src });
    mark(`photos.${photos.length - 1}.src`);
    if (photos.length >= BUSINESS_PROFILE_LIMITS.photos) break;
  }

  const links: BusinessProfile['links'] = [];
  for (let index = 0; index < BUSINESS_PROFILE_LIMITS.links * 2; index++) {
    const label = optional(form, `links_${index}_label`);
    const url = optional(form, `links_${index}_url`);
    const rawKind = optional(form, `links_${index}_kind`) as LinkKind | undefined;
    if (!label && !url && !rawKind) continue;
    const kind = rawKind && LINK_KINDS.includes(rawKind) ? rawKind : undefined;
    const link = {
      label: label ?? '',
      url: url ?? '',
      ...(kind === undefined ? {} : { kind }),
    };
    links.push(link);
    for (const key of Object.keys(link)) mark(`links.${links.length - 1}.${key}`);
    if (links.length >= BUSINESS_PROFILE_LIMITS.links) break;
  }

  const consentNote = optional(form, 'consent_note');
  return {
    identity: {
      name,
      ...(yTunnus === undefined ? {} : { yTunnus }),
      // Fall back to the prospect's vertical so a submit with the field
      // cleared (or a non-browser client) keeps the structure group.
      ...(verticalCode || verticalLabel
        ? { vertical: { code: verticalCode ?? verticalLabel!, label: verticalLabel ?? verticalCode! } }
        : prospect.vertical
          ? { vertical: { code: prospect.vertical, label: prospect.vertical } }
          : {}),
    },
    contact: {
      ...(phone === undefined ? {} : { phone }),
      ...(email === undefined ? {} : { email }),
      ...(street || postal || city
        ? { address: { street: street ?? '', postal: postal ?? '', city: city ?? '' } }
        : {}),
    },
    hours,
    exceptions,
    services: parseItems('services', BUSINESS_PROFILE_LIMITS.services),
    menu: parseItems('menu', BUSINESS_PROFILE_LIMITS.menu),
    ...(about === undefined ? {} : { about }),
    ...(tagline === undefined ? {} : { tagline }),
    photos,
    links,
    provenance,
    consent: {
      ...(form.has('consent_photos') ? { photos: true } : {}),
      ...(form.has('consent_texts') ? { texts: true } : {}),
      ...(consentNote === undefined ? {} : { note: consentNote }),
    },
  };
}

export function emptyBusinessProfile(prospect: Prospect): BusinessProfile {
  return {
    identity: {
      name: prospect.name,
      ...(prospect.yTunnus === undefined ? {} : { yTunnus: prospect.yTunnus }),
      ...(prospect.vertical === undefined
        ? {}
        : { vertical: { code: prospect.vertical, label: prospect.vertical } }),
    },
    contact: {
      ...(prospect.contactPhone === undefined ? {} : { phone: prospect.contactPhone }),
      ...(prospect.contactEmail === undefined ? {} : { email: prospect.contactEmail }),
    },
    hours: [],
    exceptions: [],
    services: [],
    menu: [],
    photos: [],
    links: [],
    provenance: {},
    consent: {},
  };
}
