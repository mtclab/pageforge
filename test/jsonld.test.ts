import { describe, expect, it } from 'vitest';
import {
  jsonLdAddress,
  jsonLdTime,
  localBusinessJsonLd,
  renderLocalBusinessJsonLd,
  schemaDaysForLabel,
} from '../src/engine/jsonld.js';
import type { SiteData } from '../src/engine/types.js';
import minimal from './fixtures/minimal.json';

const base = minimal as SiteData;

describe('LocalBusiness JSON-LD', () => {
  it('extracts address fields, the first telephone link, and parseable opening hours', () => {
    const data: SiteData = {
      ...base,
      name: 'Testiyritys',
      tagline: 'Palvelemme lähellä.',
      links: [
        { label: 'Soita', url: 'tel:+358 40 123 4567', kind: 'phone' },
        { label: 'Toinen', url: 'tel:+358 50 999 0000', kind: 'phone' },
      ],
      sections: [
        { kind: 'location', address: 'Kauppakatu 1\n00100 Helsinki' },
        {
          kind: 'hours',
          days: [
            { label: 'Ma', open: '9', close: '17:30' },
            { label: 'Ti', open: '09.00', close: '17.00' },
            { label: 'Ke', open: '24', close: '17' },
            { label: 'Su', closed: true, open: '10', close: '14' },
          ],
        },
      ],
    };
    expect(localBusinessJsonLd(data)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'Testiyritys',
      description: 'Palvelemme lähellä.',
      telephone: '+358 40 123 4567',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Kauppakatu 1',
        postalCode: '00100',
        addressLocality: 'Helsinki',
      },
      openingHoursSpecification: [{
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'Monday',
        opens: '09:00',
        closes: '17:30',
      }],
    });
  });

  it('maps FI/EN/SV labels and ranges to schema.org day enums', () => {
    expect(schemaDaysForLabel('Ma-Pe')).toEqual([
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
    ]);
    expect(schemaDaysForLabel('La, Su')).toEqual(['Saturday', 'Sunday']);
    expect(schemaDaysForLabel('Su-Ti')).toEqual(['Monday', 'Tuesday', 'Sunday']);
    expect(schemaDaysForLabel('Måndag')).toEqual(['Monday']);
    expect(schemaDaysForLabel('Arkisin')).toEqual([]);
    expect(schemaDaysForLabel('keskiviikko')).toEqual(['Wednesday']);
  });

  it('handles address and time edge cases', () => {
    expect(jsonLdAddress('Rantatie 2, 70100 Kuopio')).toMatchObject({
      streetAddress: 'Rantatie 2',
      postalCode: '70100',
      addressLocality: 'Kuopio',
    });
    expect(jsonLdAddress('Pelkkä osoite 4')).toEqual({
      '@type': 'PostalAddress',
      streetAddress: 'Pelkkä osoite 4',
    });
    expect(jsonLdAddress(' ')).toBeNull();
    expect(jsonLdTime('0')).toBe('00:00');
    expect(jsonLdTime('23:59')).toBe('23:59');
    for (const invalid of ['09.00', '24', '9:5', '12:60', 'noon']) {
      expect(jsonLdTime(invalid)).toBeNull();
    }
  });

  it('escapes script-breaking less-than signs', () => {
    const script = renderLocalBusinessJsonLd({
      ...base,
      name: '</script><script>alert(1)</script>',
      tagline: '<unsafe>',
    });
    expect(script).toContain('\\u003c/script>');
    expect(script).not.toContain('</script><script>');
    expect(script).toMatch(/^<script type="application\/ld\+json">.*<\/script>$/);
  });

  it('requires a name and at least one other business property', () => {
    expect(localBusinessJsonLd({ ...base, name: 'Nimi' })).toBeNull();
    expect(renderLocalBusinessJsonLd({ ...base, name: 'Nimi' })).toBe('');
    expect(localBusinessJsonLd({ ...base, name: 'Nimi', tagline: 'Kuvaus' })).toMatchObject({
      name: 'Nimi',
      description: 'Kuvaus',
    });
  });
});
