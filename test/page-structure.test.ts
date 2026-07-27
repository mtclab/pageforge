// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { decodeSiteData } from '../src/app/site-data.js';
import { renderSite } from '../src/engine/render.js';
import type { SiteData } from '../src/engine/types.js';
import { getTheme, THEMES } from '../src/themes/index.js';
import { validateSiteData } from '../src/worker/validate.js';
import minimal from './fixtures/minimal.json';

const base = minimal as SiteData;
const theme = getTheme(base.meta.themeId);

function parse(html: string): Document {
  return new DOMParser().parseFromString(
    html.replace('<link rel="stylesheet" href="style.css">', ''),
    'text/html',
  );
}

/**
 * Gallery alt text.
 *
 * The gallery is the section people add to show their work, and every picture
 * in it shipped as alt="" with no way to say anything else - so to a blind
 * visitor the section was empty. Alt now comes from the author; blank still
 * means "decorative" (alt="", which screen readers skip) rather than a
 * filename read aloud.
 */
describe('gallery pictures carry the author\'s description', () => {
  const described: SiteData = {
    ...base,
    sections: [
      {
        kind: 'gallery',
        photos: [
          { dataUrl: 'data:image/jpeg;base64,/9j/4AAQ', alt: 'Kesäkurpitsat penkissä' },
          { dataUrl: 'data:image/jpeg;base64,/9j/4AAR' },
        ],
      },
    ],
  };

  it('reaches the visitor, on every theme', () => {
    for (const each of THEMES) {
      const doc = parse(renderSite(described, each).html);
      const alts = [...doc.querySelectorAll('.gallery img')].map((img) => img.getAttribute('alt'));
      expect(alts, each.id).toEqual(['Kesäkurpitsat penkissä', '']);
    }
  });

  it('survives the draft and the share link round-trip', () => {
    const decoded = decodeSiteData(JSON.parse(JSON.stringify(described)));
    expect(decoded).not.toBeNull();
    const gallery = decoded!.sections[0] as Extract<SiteData['sections'][number], { kind: 'gallery' }>;
    expect(gallery.photos[0]).toEqual({ dataUrl: 'data:image/jpeg;base64,/9j/4AAQ', alt: 'Kesäkurpitsat penkissä' });
    expect(gallery.photos[1]).toEqual({ dataUrl: 'data:image/jpeg;base64,/9j/4AAR' });
    const doc = parse(renderSite(decoded!, theme).html);
    expect(doc.querySelector('.gallery img')?.getAttribute('alt')).toBe('Kesäkurpitsat penkissä');
  });

  it('is validated like any other user string', () => {
    expect(validateSiteData(described)).toBeNull();
    const tooLong: SiteData = {
      ...base,
      sections: [{ kind: 'gallery', photos: [{ dataUrl: 'data:image/jpeg;base64,/9j/4AAQ', alt: 'x'.repeat(251) }] }],
    };
    expect(validateSiteData(tooLong)).toBe('bad image description');
    expect(decodeSiteData(JSON.parse(JSON.stringify(tooLong)))).toBeNull();
  });
});

/**
 * Heading outline.
 *
 * A service group heading was an h3 and so was every service inside it, so
 * "Hair" and "Cut" read as siblings to anything navigating by heading level.
 * The rule below is the general one: a heading inside a list may not sit at or
 * above the level of the heading that introduces that list.
 */
describe('heading levels describe the real nesting', () => {
  const withGroups: SiteData = {
    ...base,
    sections: [
      { kind: 'about', text: 'About me.' },
      { kind: 'projects', items: [{ name: 'Zine' }] },
      {
        kind: 'services',
        items: [
          { name: 'Cut', group: 'Hair' },
          { name: 'Colour', group: 'Hair' },
          { name: 'Manicure', group: 'Nails' },
        ],
      },
      {
        kind: 'hours',
        days: [{ label: 'Mon', open: '09:00', close: '17:00' }],
        exceptions: [{ date: '24.12.', text: 'Closed' }],
      },
    ],
  };

  const level = (element: Element): number => Number(element.tagName.slice(1));

  it('a group heading sits above the items it introduces', () => {
    const doc = parse(renderSite(withGroups, theme).html);
    const groups = [...doc.querySelectorAll('.service-group')];
    expect(groups.map((g) => g.textContent)).toEqual(['Hair', 'Nails']);
    for (const group of groups) {
      expect(group.tagName).toBe('H3');
      const list = group.nextElementSibling!;
      expect(list.tagName).toBe('UL');
      for (const heading of list.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
        expect(level(heading), `${group.textContent} > ${heading.textContent}`)
          .toBeGreaterThan(level(group));
      }
    }
  });

  it('an ungrouped list keeps its items directly under the section heading', () => {
    const ungrouped: SiteData = {
      ...base,
      sections: [{ kind: 'services', items: [{ name: 'Cut' }, { name: 'Colour' }] }],
    };
    const doc = parse(renderSite(ungrouped, theme).html);
    expect(doc.querySelector('.service-group')).toBeNull();
    expect([...doc.querySelectorAll('.service h3')].map((h) => h.textContent)).toEqual(['Cut', 'Colour']);
  });

  it('no list anywhere repeats the level of the heading that introduces it', () => {
    for (const each of THEMES) {
      const doc = parse(renderSite(withGroups, each).html);
      for (const list of doc.querySelectorAll('ul, ol, dl')) {
        const before = list.previousElementSibling;
        if (!before || !/^H[1-6]$/.test(before.tagName)) continue;
        for (const heading of list.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
          expect(level(heading), `${each.id}: ${before.textContent} > ${heading.textContent}`)
            .toBeGreaterThan(level(before));
        }
      }
    }
  });
});

/**
 * Long words on a phone.
 *
 * `p, li` had overflow-wrap but `dt, dd` did not, so one long opening-hours
 * label or a street address in a definition list pushed the whole page
 * sideways on a 390px screen. The gate is the general one: every element that
 * ends up holding the author's text must be covered by a wrap rule, itself or
 * through an ancestor (overflow-wrap inherits).
 */
describe('user text can never push the page sideways', () => {
  const LONG = 'Kansanedustajaehdokas'.repeat(4);

  const wordy: SiteData = {
    ...base,
    name: LONG,
    tagline: LONG,
    links: [{ label: LONG, url: `https://example.com/${LONG}` }],
    sections: [
      { kind: 'about', text: LONG },
      { kind: 'projects', items: [{ name: LONG, desc: LONG }] },
      { kind: 'hobbies', items: [LONG] },
      { kind: 'custom', title: LONG, text: LONG },
      { kind: 'services', items: [{ name: LONG, group: LONG, desc: LONG, price: LONG }] },
      {
        kind: 'hours',
        days: [{ label: LONG, open: '09:00', close: '17:00' }],
        exceptions: [{ date: LONG, text: LONG }],
      },
      { kind: 'location', address: LONG, phone: '+358 40 123 4567' },
      { kind: 'notice', text: LONG, until: LONG },
    ],
  };

  /** Tag names any `overflow-wrap: break-word` rule in the sheet applies to. */
  function wrappingTags(css: string): Set<string> {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const tags = new Set<string>();
    for (const [, selector] of bare.matchAll(/([^{}]+)\{[^{}]*overflow-wrap:\s*break-word[^{}]*\}/g)) {
      for (const part of (selector ?? '').split(',')) {
        const tag = part.trim().toLowerCase();
        if (/^[a-z][a-z0-9]*$/.test(tag)) tags.add(tag);
      }
    }
    return tags;
  }

  it('every element holding a long word is covered by a wrap rule', () => {
    for (const each of THEMES) {
      const { html, css } = renderSite(wordy, each);
      const tags = wrappingTags(css);
      expect(tags.size).toBeGreaterThan(0);
      const doc = parse(html);
      // Only what is laid out: <title> holds the name too, harmlessly.
      const holders = [...doc.body.querySelectorAll('*')].filter((element) => [...element.childNodes]
        .some((node) => node.nodeType === 3 && (node.textContent ?? '').includes(LONG)));
      expect(holders.length, each.id).toBeGreaterThan(5);
      for (const holder of holders) {
        let node: Element | null = holder;
        let covered = false;
        while (node && !covered) {
          covered = tags.has(node.tagName.toLowerCase());
          node = node.parentElement;
        }
        expect(covered, `${each.id}: <${holder.tagName.toLowerCase()}> holds an unbreakable word`)
          .toBe(true);
      }
    }
  });
});
