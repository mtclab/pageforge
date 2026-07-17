import { describe, expect, it } from 'vitest';
import type { SiteData } from '../src/engine/types.js';
import type { BusinessProfile } from '../src/worker/business-profile.js';
import { compose, themeFamilyForTheme } from '../src/worker/composer.js';
import { structureProfileFor, verticalGroupFor } from '../src/worker/structure-profiles.js';
import { validateSiteData } from '../src/worker/validate.js';

function profile(vertical = 'grilli'): BusinessProfile {
  return {
    identity: { name: 'Testipaikka', vertical: { code: vertical, label: vertical } },
    contact: {
      phone: '+358 40 123 4567',
      email: 'hei@example.com',
      address: { street: 'Katu 1', postal: '00100', city: 'Helsinki' },
    },
    hours: [{ label: 'Ma', open: '09:00', close: '17:00' }],
    services: [{ name: 'Korjaus', price: '50 €' }],
    menu: [{ name: 'Burgeri', price: '12,50 €' }],
    about: 'Paikallinen yritys.',
    tagline: 'Tervetuloa',
    photos: [{ src: `/img/${'a'.repeat(64)}` }],
    links: [{ label: 'Instagram', url: 'https://instagram.com/example', kind: 'instagram' }],
    provenance: {},
    consent: { photos: true, texts: true },
  };
}

function contentOnly(data: SiteData): Omit<SiteData, 'meta'> {
  const { meta: _meta, ...content } = data;
  return content;
}

describe('structure profiles', () => {
  it('maps known verticals and falls back to general for unknown values', () => {
    expect(verticalGroupFor('grilli')).toBe('food');
    expect(verticalGroupFor(undefined, 'Hius- ja kauneuspalvelu')).toBe('appearance');
    expect(verticalGroupFor('autokorjaamo')).toBe('repair');
    expect(verticalGroupFor('74999')).toBe('general');
    expect(structureProfileFor('unknown')).toBe(structureProfileFor());
  });
});

describe('deterministic composer', () => {
  it('returns deterministic variants from three distinct theme families', () => {
    const first = compose(profile(), 'profile1');
    const second = compose(profile(), 'profile1');
    expect(first).toEqual(second);
    expect(first).toHaveLength(3);
    expect(new Set(first.map((variant) => themeFamilyForTheme(variant.meta.themeId))).size).toBe(3);
  });

  it('derives a Soita tel link from the contact phone without duplicating one', () => {
    const withPhone = compose(profile(), 'tel1')[0]!;
    expect(withPhone.links[0]).toEqual({ label: 'Soita', url: 'tel:+358 40 123 4567', kind: 'phone' });
    const existing = profile();
    existing.links = [{ label: 'Puhelin', url: 'tel:+358401234567', kind: 'phone' }];
    const kept = compose(existing, 'tel2')[0]!;
    expect(kept.links.filter((link) => link.url.startsWith('tel:'))).toHaveLength(1);
    expect(kept.links[0]!.label).toBe('Puhelin');
  });

  it('keeps content identical, emits no empty sections, and passes SiteData validation', () => {
    const variants = compose(profile(), 'profile2');
    expect(contentOnly(variants[1]!)).toEqual(contentOnly(variants[0]!));
    expect(contentOnly(variants[2]!)).toEqual(contentOnly(variants[0]!));
    for (const variant of variants) {
      expect(validateSiteData(variant)).toBeNull();
      for (const section of variant.sections) {
        if ('items' in section) expect(section.items.length).toBeGreaterThan(0);
        if (section.kind === 'hours') expect(section.days.length).toBeGreaterThan(0);
        if (section.kind === 'gallery') expect(section.photos.length).toBeGreaterThan(0);
        if (section.kind === 'about') expect(section.text).not.toBe('');
      }
    }
  });

  it('never lets the vertical change the aesthetic choices for a seed', () => {
    const food = compose(profile('grilli'), 'same-seed');
    const repair = compose(profile('korjaamo'), 'same-seed');
    expect(food.map(({ meta }) => meta)).toEqual(repair.map(({ meta }) => meta));
    expect(food[0]!.sections.some((section) => section.kind === 'services' && section.title === 'Ruokalista')).toBe(true);
    expect(repair[0]!.sections.some((section) => section.kind === 'services' && section.title === 'Ruokalista')).toBe(false);
  });

  it('omits every section when a minimal profile has no section content', () => {
    const minimal = profile('unknown');
    minimal.contact = {};
    minimal.hours = [];
    minimal.services = [];
    minimal.menu = [];
    minimal.about = undefined;
    minimal.photos = [];
    const variants = compose(minimal, 'empty');
    expect(variants.every((variant) => variant.sections.length === 0)).toBe(true);
    expect(variants.every((variant) => validateSiteData(variant) === null)).toBe(true);
  });
});
