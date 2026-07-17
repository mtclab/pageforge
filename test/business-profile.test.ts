import { describe, expect, it } from 'vitest';
import type { BusinessProfile } from '../src/worker/business-profile.js';
import {
  businessProfileWarnings,
  validateBusinessProfile,
  validateFinnishPostalCode,
  validateHttpsUrl,
  validatePhone,
  validateYTunnus,
} from '../src/worker/business-profile.js';

function profile(): BusinessProfile {
  return {
    identity: { name: 'Koeyritys', yTunnus: '1572860-0' },
    contact: {
      phone: '+358 40 123 4567',
      address: { street: 'Katu 1', postal: '00100', city: 'Helsinki' },
    },
    hours: [{ label: 'Maanantai', open: '09:00', close: '17:00' }],
    services: [{ name: 'Työ', price: '35 €' }],
    menu: [],
    photos: [],
    links: [{ label: 'Kotisivu', url: 'https://example.com', kind: 'website' }],
    provenance: { 'identity.name': { source: 'operator', at: 1 } },
    consent: {},
  };
}

describe('BusinessProfile validators', () => {
  it('validates Finnish business ids with the mod-11 checksum', () => {
    expect(validateYTunnus('1572860-0')).toBe(true);
    expect(validateYTunnus('1234567-1')).toBe(true);
    expect(validateYTunnus('1234567-2')).toBe(false);
    expect(validateYTunnus('12345678')).toBe(false);
  });

  it('validates postal codes, phone shapes, and HTTPS URLs', () => {
    expect(validateFinnishPostalCode('00100')).toBe(true);
    expect(validateFinnishPostalCode('0100')).toBe(false);
    expect(validatePhone('+358 (0)40 123-4567')).toBe(true);
    expect(validatePhone('call-me')).toBe(false);
    expect(validateHttpsUrl('https://example.com/path')).toBe(true);
    expect(validateHttpsUrl('http://example.com')).toBe(false);
    expect(validateHttpsUrl('javascript:alert(1)')).toBe(false);
  });

  it('accepts operator-typed hour-only and dot times', () => {
    const short = profile();
    short.hours = [
      { label: 'Ma-Pe', open: '9', close: '21' },
      { label: 'La', open: '9.30', close: '14:00' },
    ];
    expect(validateBusinessProfile(short)).toEqual([]);
    const wrapped = profile();
    wrapped.hours = [{ label: 'Ma', open: '21', close: '9' }];
    expect(validateBusinessProfile(wrapped)).toEqual([]);

    const equal = profile();
    equal.hours = [{ label: 'Ma', open: '09:00', close: '9' }];
    expect(validateBusinessProfile(equal)).toContain(
      'Avaus- ja sulkemisaika eivät voi olla samat.',
    );
  });

  it('checks hours, duplicate days, item limits, prices, and photo paths', () => {
    expect(validateBusinessProfile(profile())).toEqual([]);
    const invalid = profile();
    invalid.hours = [
      { label: 'Ma', open: '09:00', close: '09:00' },
      { label: 'ma', open: '09:00', close: '17:00' },
    ];
    invalid.services = [{ name: 'Työ', price: 'free<script>' }];
    invalid.photos = [{ src: '/img/not-a-hash' }];
    expect(validateBusinessProfile(invalid)).toEqual(expect.arrayContaining([
      expect.stringContaining('eivät voi olla samat'),
      expect.stringContaining('useammin'),
      expect.stringContaining('hinta'),
      expect.stringContaining('/img/<sha256>'),
    ]));
  });

  it('collects contradictions as non-blocking warnings', () => {
    const data = profile();
    data.hours = [{ label: 'Sunnuntai', open: '09:00', close: '12:00', closed: true }];
    data.about = 'Omistajan teksti';
    data.photos = [{ src: `/img/${'a'.repeat(64)}` }];
    const warnings = businessProfileWarnings(data, {
      name: 'Eri nimi',
      contactPhone: '050 000 0000',
    });
    expect(warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('merkitty suljetuksi'),
      expect.stringContaining('kuvasuostumusta'),
      expect.stringContaining('tekstisuostumusta'),
      expect.stringContaining('Nimi poikkeaa'),
      expect.stringContaining('Puhelin poikkeaa'),
    ]));
    expect(validateBusinessProfile(data)).toEqual([]);
  });
});
