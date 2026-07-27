// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  BUSINESS_LABELS,
  PERSONAL_LABELS,
  businessLabels,
  isBusinessSite,
  labelContext,
  personalLabels,
} from '../src/engine/localization.js';
import { renderSite } from '../src/engine/render.js';
import type { SiteData } from '../src/engine/types.js';
import { getTheme, THEMES } from '../src/themes/index.js';
import appearance from './fixtures/biz-appearance.json';
import minimal from './fixtures/minimal.json';

/**
 * The language gate.
 *
 * Picking Finnish used to get you a half-Finnish page: `Tietoa meistä` (and
 * "about US" on a page about one person - the personal path was borrowing the
 * business label set) sitting next to hardcoded English `Things I make`,
 * `Things I love` and `Email me`. Picking Japanese got you `<html lang="ja">`
 * over an entirely English page. The old coverage tested Swedish on a business
 * fixture only, and business fixtures have no about, projects or hobbies
 * section - so none of it was ever looked at.
 *
 * These assert what the visitor actually reads:
 *   - a personal page speaks about a person, not "us";
 *   - a page in fi/sv has no English heading left anywhere;
 *   - a page in a language we have no labels for still declares its own
 *     language (the author's words really are in it) and marks OUR English
 *     words as English, so nothing on the page claims to be what it is not.
 */

const base = minimal as SiteData;

/** Every personal section kind, with no titles of their own, so defaults show. */
function personalSite(lang?: string): SiteData {
  return {
    ...base,
    name: 'Anna Virtanen',
    ...(lang === undefined ? {} : { lang }),
    links: [{ label: '', url: 'mailto:anna@example.com', kind: 'email' }],
    sections: [
      { kind: 'about', text: 'I grow things.' },
      { kind: 'projects', items: [{ name: 'Zine' }] },
      { kind: 'hobbies', items: ['Baking'] },
      { kind: 'contact', email: 'anna@example.com' },
      { kind: 'gallery', photos: [{ dataUrl: 'data:image/jpeg;base64,/9j/x' }] },
    ],
  };
}

function businessSite(lang: string): SiteData {
  return { ...(appearance as SiteData), lang };
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(
    html.replace('<link rel="stylesheet" href="style.css">', ''),
    'text/html',
  );
}

/** The nearest declared language for an element, as a browser resolves it. */
function effectiveLang(element: Element): string {
  let node: Element | null = element;
  while (node) {
    const lang = node.getAttribute('lang');
    if (lang) return lang;
    node = node.parentElement;
  }
  return '';
}

const ENGLISH_LABELS = [
  ...Object.values(PERSONAL_LABELS.en),
  ...Object.values(BUSINESS_LABELS.en),
];

describe('label voice: a person is not a company', () => {
  it('a Finnish personal page says "about me", never "about us"', () => {
    const html = renderSite(personalSite('fi'), getTheme(base.meta.themeId)).html;
    expect(html).toContain('Tietoa minusta');
    expect(html).not.toContain('Tietoa meistä');
  });

  it('a Finnish business page keeps the business voice', () => {
    const data: SiteData = {
      ...businessSite('fi'),
      sections: [
        { kind: 'about', text: 'Olemme parturi-kampaamo.' },
        ...(appearance as SiteData).sections,
      ],
    };
    const html = renderSite(data, getTheme(data.meta.themeId)).html;
    expect(html).toContain('Tietoa meistä');
    expect(html).not.toContain('Tietoa minusta');
  });

  it('business-only data is what marks a page as a business, on any path', () => {
    expect(isBusinessSite(personalSite('fi'), false)).toBe(false);
    expect(isBusinessSite(personalSite('fi'), true)).toBe(true);
    expect(isBusinessSite(appearance as SiteData, false)).toBe(true);
    expect(isBusinessSite({ ...base, business: { city: 'Kuopio' } }, false)).toBe(true);
    expect(isBusinessSite(
      { ...base, sections: [{ kind: 'hours', days: [{ label: 'Ma', closed: true }] }] },
      false,
    )).toBe(true);
  });
});

describe('a page in a language we have labels for is fully in that language', () => {
  for (const locale of ['fi', 'sv'] as const) {
    it(`personal page in ${locale} has no English heading left`, () => {
      for (const theme of THEMES) {
        const data = { ...personalSite(locale), meta: { ...base.meta, themeId: theme.id } };
        const doc = parse(renderSite(data, theme).html);
        const headings = [...doc.querySelectorAll('h2')].map((h) => h.textContent);
        expect(headings).toEqual([
          PERSONAL_LABELS[locale].about,
          PERSONAL_LABELS[locale].projects,
          PERSONAL_LABELS[locale].hobbies,
          PERSONAL_LABELS[locale].contact,
          PERSONAL_LABELS[locale].gallery,
        ]);
        expect(doc.querySelector('[data-email-a]')?.textContent)
          .toBe(PERSONAL_LABELS[locale].email);
        // Nothing anywhere on the page is left in English.
        const text = doc.body.textContent ?? '';
        for (const english of ENGLISH_LABELS) {
          const localised: string[] = Object.values(PERSONAL_LABELS[locale]);
          if (localised.includes(english)) {
            continue;
          }
          expect(text, `${theme.id}: ${english}`).not.toContain(english);
        }
        // ...and nothing is marked as English, because nothing is English.
        expect(doc.querySelectorAll('[lang="en"]')).toHaveLength(0);
      }
    });

    it(`business page in ${locale} localises the hero badge and call button`, () => {
      const data: SiteData = {
        ...businessSite(locale),
        links: [{ label: '', url: 'tel:+358 40 123 4567', kind: 'phone' }],
        sections: [
          { kind: 'about', text: 'Perustettu 1998. Palvelemme sinua.' },
          ...(appearance as SiteData).sections,
        ],
      };
      const html = renderSite(data, getTheme(data.meta.themeId), {
        heroCta: true,
        bizHero: true,
      }).html;
      expect(html).toContain(`>${BUSINESS_LABELS[locale].call}</a>`);
      expect(html).toContain(`${BUSINESS_LABELS[locale].since} 1998`);
    });
  }
});

describe('a page in a language we have no labels for tells the truth', () => {
  const japanese = personalSite('ja');

  it('keeps the author\'s own language on the document', () => {
    const html = renderSite(japanese, getTheme(base.meta.themeId)).html;
    expect(html).toContain('<html lang="ja">');
  });

  it('marks every English word we generated as English', () => {
    const doc = parse(renderSite(japanese, getTheme(base.meta.themeId)).html);
    const generated = [...doc.querySelectorAll('h2, h3, [data-email-a] span, .cta-call, .badge-year')];
    const english = generated.filter((el) => ENGLISH_LABELS.includes(el.textContent?.trim() ?? ''));
    expect(english.length).toBeGreaterThan(0);
    for (const element of english) {
      expect(effectiveLang(element), element.textContent ?? '').toBe('en');
    }
  });

  it('does not mark the author\'s own words as English', () => {
    const data: SiteData = {
      ...japanese,
      sections: [
        { kind: 'custom', title: '私について', text: '庭で野菜を育てています。' },
        { kind: 'projects', title: '作品', items: [{ name: 'Zine' }] },
      ],
    };
    const doc = parse(renderSite(data, getTheme(base.meta.themeId)).html);
    for (const heading of doc.querySelectorAll('h2')) {
      expect(heading.hasAttribute('lang'), heading.textContent ?? '').toBe(false);
    }
  });
});

describe('label sets', () => {
  it('fi/en/sv are complete for both voices, and unknown languages fall back', () => {
    const businessKeys = Object.keys(BUSINESS_LABELS.en).sort();
    const personalKeys = Object.keys(PERSONAL_LABELS.en).sort();
    for (const locale of ['fi', 'en', 'sv'] as const) {
      expect(Object.keys(BUSINESS_LABELS[locale]).sort()).toEqual(businessKeys);
      expect(Object.keys(PERSONAL_LABELS[locale]).sort()).toEqual(personalKeys);
      expect(Object.values(BUSINESS_LABELS[locale]).every(Boolean)).toBe(true);
      expect(Object.values(PERSONAL_LABELS[locale]).every(Boolean)).toBe(true);
    }
    expect(businessLabels('de')).toBe(BUSINESS_LABELS.en);
    expect(personalLabels('de')).toBe(PERSONAL_LABELS.en);
    expect(businessLabels('fi-FI')).toBe(BUSINESS_LABELS.fi);
    expect(labelContext({ ...base, lang: 'fi-FI' }).labelLangAttr).toBe('');
    expect(labelContext({ ...base, lang: 'ja' }).labelLangAttr).toBe(' lang="en"');
    expect(labelContext(base).labelLangAttr).toBe('');
  });
});
