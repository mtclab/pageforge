import { describe, expect, it } from 'vitest';
import { BUSINESS_LABELS, businessLabels } from '../src/engine/localization.js';
import { renderSite } from '../src/engine/render.js';
import type { SiteData } from '../src/engine/types.js';
import { getTheme } from '../src/themes/index.js';
import { bizHtml } from '../src/worker/biz.js';
import { validateSiteData } from '../src/worker/validate.js';
import appearance from './fixtures/biz-appearance.json';
import food from './fixtures/biz-food.json';
import general from './fixtures/biz-general.json';
import repair from './fixtures/biz-repair.json';
import minimal from './fixtures/minimal.json';

const fixtures = { food, appearance, repair, general } as Record<string, SiteData>;
const base = minimal as SiteData;

describe('renderer completion', () => {
  for (const [sector, data] of Object.entries(fixtures)) {
    it(`renders the ${sector} fixture through the engine and business wrapper`, () => {
      expect(validateSiteData(data)).toBeNull();
      const rendered = renderSite(data, getTheme(data.meta.themeId));
      const business = bizHtml(data, false);
      expect(rendered.html).toContain(`<title>${data.name}</title>`);
      expect(business).toContain('<style>');
      expect(business).toContain('application/ld+json');
      expect({ rendered: rendered.html, business }).toMatchSnapshot();
    });
  }

  it('has complete fi/en/sv labels and uses Swedish business headings', () => {
    const keys = Object.keys(BUSINESS_LABELS.en).sort();
    for (const locale of ['fi', 'en', 'sv'] as const) {
      expect(Object.keys(BUSINESS_LABELS[locale]).sort()).toEqual(keys);
      expect(Object.values(BUSINESS_LABELS[locale]).every(Boolean)).toBe(true);
    }
    expect(businessLabels('de')).toBe(BUSINESS_LABELS.en);

    const swedish: SiteData = { ...appearance as SiteData, lang: 'sv' };
    const html = renderSite(swedish, getTheme(swedish.meta.themeId)).html;
    expect(html).toContain('Öppettider');
    expect(html).toContain('Tjänster');
    expect(html).toContain('Bilder');
    expect(html).toContain('Kontakt');
    expect(html).toContain('Stängt');
  });

  it('renders a call CTA only when heroCta is enabled', () => {
    const data: SiteData = {
      ...base,
      links: [
        { label: '', url: 'tel:+358 40 123 4567', kind: 'phone' },
        { label: '<Soita toinen>', url: 'tel:+358 50 234 5678', kind: 'phone' },
      ],
    };
    expect(renderSite(data, getTheme(data.meta.themeId)).html).not.toContain('class="cta-call"');
    const html = renderSite(data, getTheme(data.meta.themeId), { heroCta: true }).html;
    expect(html).toContain('<a class="cta-call" href="tel:+358 40 123 4567">Soita</a>');
    expect(html).not.toContain('class="cta-call" href="tel:+358 50 234 5678"');
  });

  it('validates telephone links and the branding preference', () => {
    for (const url of ['tel:+358 40 123 4567', 'tel:050-12345', 'tel:(09) 123 456']) {
      expect(validateSiteData({ ...base, links: [{ label: 'Soita', url, kind: 'phone' }] })).toBeNull();
    }
    for (const url of ['tel:1234', 'tel:+358.40.123', 'tel:+358<script>', 'TEL:+358401234', ' tel:+358401234']) {
      expect(validateSiteData({ ...base, links: [{ label: 'Soita', url, kind: 'phone' }] })).toBe(
        'bad telephone link',
      );
    }
    expect(validateSiteData({
      ...base,
      meta: { ...base.meta, hideBranding: 'yes' as unknown as boolean },
    })).toBe('bad branding preference');
  });

  it('adds published branding unless paid branding is hidden, while drafts retain the banner', () => {
    expect(bizHtml(base, false)).toContain('<p class="mikoshi-credit">Sivut: Mikoshi</p>');
    expect(bizHtml({ ...base, meta: { ...base.meta, hideBranding: true } }, false)).not.toContain('Sivut: Mikoshi');
    const draft = bizHtml({ ...base, meta: { ...base.meta, hideBranding: true } }, true);
    expect(draft).toContain('Luonnos - esikatselu');
  });
});
