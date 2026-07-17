import { describe, expect, it } from 'vitest';
import { renderSite } from '../src/engine/render.js';
import type { SiteData } from '../src/engine/types.js';
import { validateSiteData } from '../src/worker/index.js';
import { THEMES } from '../src/themes/index.js';
import minimal from './fixtures/minimal.json';

const base = minimal as SiteData;

function businessSite(lang = 'fi'): SiteData {
  return {
    ...base,
    lang,
    business: { phone: '+358 40 123 4567', address: 'Kauppakatu 1', yTunnus: '1234567-8' },
    capabilities: { hours: true, services: true, notice: true, location: true },
    sections: [
      {
        kind: 'hours',
        days: [
          { label: 'Maanantai', open: '09.00', close: '17.00' },
          { label: 'Sunnuntai', closed: true },
        ],
        exceptions: [{ date: '24.12.', text: 'Suljettu' }],
      },
      { kind: 'services', items: [{ name: 'Leikkaus', desc: 'Sisältää pesun', price: '35 €' }] },
      { kind: 'notice', text: 'Lomalla viikon 30', until: '28.7.' },
      { kind: 'location', mapUrl: 'https://maps.example.com/place' },
    ],
  };
}

describe('business sections', () => {
  it('renders every business section with Finnish defaults and business fallbacks', () => {
    const { html } = renderSite(businessSite(), THEMES[0]!);
    expect(html).toContain('Aukioloajat');
    expect(html).toContain('09.00–17.00');
    expect(html).toContain('Suljettu');
    expect(html).toContain('Poikkeusaukiolot');
    expect(html).toContain('Palvelut');
    expect(html).toContain('35 €');
    expect(html).toContain('section-notice');
    expect(html).toContain('Lomalla viikon 30');
    expect(html).toContain('Yhteystiedot');
    expect(html).toContain('Kauppakatu 1');
    expect(html).toContain('href="tel:+358 40 123 4567"');
    expect(html).toContain('href="https://maps.example.com/place"');
  });

  it('uses English defaults and lets explicit titles win', () => {
    const data = businessSite('en-US');
    data.sections = [
      { kind: 'hours', title: 'When', days: [{ label: 'Sunday', closed: true }] },
      { kind: 'services', items: [{ name: 'Cut' }] },
      { kind: 'location', address: 'Main Street 1' },
    ];
    const { html } = renderSite(data, THEMES[0]!);
    expect(html).toContain('When');
    expect(html).toContain('Closed');
    expect(html).toContain('Services');
    expect(html).toContain('Contact');
    expect(html).not.toContain('Aukioloajat');
  });

  it('escapes hostile strings and rejects unsafe map links at render time', () => {
    const data = businessSite();
    data.business = { address: '<img src=x onerror=alert(1)>', phone: '"><script>alert(1)</script>' };
    data.sections = [
      { kind: 'hours', title: '<svg onload=alert(1)>', days: [{ label: '<b>Mon</b>', open: '<x>', close: '&' }] },
      { kind: 'services', items: [{ name: '<script>x</script>', desc: '<img src=x>', price: '5 & 6' }] },
      { kind: 'notice', text: '<script>notice</script>', until: '<b>now</b>' },
      { kind: 'location', mapUrl: 'javascript:alert(1)' },
    ];
    const { html } = renderSite(data, THEMES[0]!);
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<svg onload');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('&lt;script&gt;notice&lt;/script&gt;');
    expect(html).toContain('5 &amp; 6');
    expect(html).toContain('href="tel:&quot;&gt;&lt;script&gt;alert(1)&lt;script&gt;"');
  });

  it('normalizes intake-valid punctuation in location phone links', () => {
    const data = businessSite();
    data.sections = [{ kind: 'location', phone: '09/1234  567' }];
    expect(renderSite(data, THEMES[0]!).html).toContain('href="tel:091234 567"');
  });
});

describe('business SiteData validation', () => {
  it('accepts a complete business site', () => {
    expect(validateSiteData(businessSite())).toBeNull();
  });

  it('rejects oversized and malformed business sections', () => {
    const variants: SiteData[] = [
      { ...businessSite(), sections: [{ kind: 'hours', days: Array.from({ length: 15 }, (_, i) => ({ label: String(i) })) }] },
      { ...businessSite(), sections: [{ kind: 'hours', days: [], exceptions: Array.from({ length: 21 }, () => ({ date: 'x', text: 'x' })) }] },
      { ...businessSite(), sections: [{ kind: 'services', items: Array.from({ length: 61 }, () => ({ name: 'x' })) }] },
      { ...businessSite(), sections: [{ kind: 'notice', text: 'x'.repeat(301) }] },
      { ...businessSite(), sections: [{ kind: 'location', address: 'x'.repeat(201) }] },
      { ...businessSite(), sections: [{ kind: 'location', phone: 'x'.repeat(201) }] },
      { ...businessSite(), sections: [{ kind: 'location', mapUrl: 'javascript:alert(1)' }] },
      { ...businessSite(), sections: [{ kind: 'location', mapUrl: `https://example.com/${'x'.repeat(501)}` }] },
    ];
    for (const variant of variants) expect(validateSiteData(variant)).not.toBeNull();
  });
});
