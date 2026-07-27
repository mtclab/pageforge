// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { previewHtml } from '../src/app/preview.js';
import { renderSite, type RenderOptions } from '../src/engine/render.js';
import type { SiteData } from '../src/engine/types.js';
import { THEMES } from '../src/themes/index.js';
import hostileAttr from '../test/fixtures/hostile-attr.json';

/**
 * The attribute gate.
 *
 * Every string the visitor's browser reads as an ATTRIBUTE goes through
 * escAttr, and the difference between escAttr and esc is one replaceAll of the
 * double quote. Drop it and a name of `Anna" onload="alert(...)` stops being
 * text inside alt="..." and becomes a live onload handler on the published
 * page - on someone else's website, under their own name.
 *
 * Nothing used to notice. The three named security tests all stayed green with
 * that mutation in place (verified by reverting it) because they look at the
 * page as a STRING: a href="([^"]*)" regex simply truncates at the injected
 * quote, and the hostile fixture's quotes were never followed by a handler.
 * Only snapshots moved, and a `vitest -u` sweep blesses those silently.
 *
 * So this gate asserts the PARSED result - what the browser actually ends up
 * with - across every theme and every render path:
 *
 *   1. no element carries an event-handler attribute, ever; and
 *   2. no element carries any attribute the engine did not author, so an
 *      injected `style`, `srcdoc` or `formaction` fails the same way.
 *
 * The fixture feeds a quote-plus-handler payload into every field that reaches
 * an attribute (name, tagline, photo src, gallery src and alt, mail address,
 * link and map URLs, phone, style overrides). Under the escAttr -> esc
 * mutation this file fails with 8 injected handlers across img, meta and a.
 */

const hostile = hostileAttr as unknown as SiteData;

/** Attribute names the engine itself writes. Nothing else may reach the DOM. */
const AUTHORED_ATTRIBUTES = new Set([
  'charset', 'name', 'content', 'property', 'rel', 'href', 'type', 'lang',
  'class', 'id', 'src', 'alt', 'width', 'height', 'loading', 'role',
  'aria-label', 'aria-labelledby', 'aria-hidden', 'viewBox', 'd',
  'data-email-a', 'data-email-b',
]);

const RENDER_PATHS: { label: string; opts: RenderOptions }[] = [
  { label: 'zip download', opts: {} },
  { label: 'hosted publish', opts: { hosted: true, baseUrl: 'https://pageforge.mtclab.net/s/anna' } },
];

function parse(html: string): Document {
  // The stylesheet link is dropped so happy-dom does not try to fetch it.
  return new DOMParser().parseFromString(
    html.replace('<link rel="stylesheet" href="style.css">', ''),
    'text/html',
  );
}

function attributesOf(doc: Document): { tag: string; name: string; value: string }[] {
  const out: { tag: string; name: string; value: string }[] = [];
  for (const element of doc.querySelectorAll('*')) {
    for (const attr of element.attributes) {
      out.push({ tag: element.tagName.toLowerCase(), name: attr.name, value: attr.value });
    }
  }
  return out;
}

function eventHandlers(doc: Document): string[] {
  return attributesOf(doc)
    .filter((attr) => /^on/i.test(attr.name))
    .map((attr) => `${attr.tag}[${attr.name}]`);
}

function unauthored(doc: Document): string[] {
  return attributesOf(doc)
    .filter((attr) => !AUTHORED_ATTRIBUTES.has(attr.name))
    .map((attr) => `${attr.tag}[${attr.name}]`);
}

describe('attribute escaping (parsed DOM)', () => {
  it('the fixture really does reach the attributes it is meant to test', () => {
    // Without this the gate could pass by rendering nothing at all.
    const doc = parse(renderSite(hostile, THEMES[0]!).html);
    const values = attributesOf(doc).map((attr) => attr.value);
    const carrying = values.filter((value) => value.includes('="alert('));
    expect(carrying.length).toBeGreaterThanOrEqual(4);
    // The payload survives as inert TEXT inside the attribute, quote and all.
    expect(values).toContain('A cat" onmouseup="alert(\'alt\')');
    expect(doc.querySelector('img.photo')?.getAttribute('alt'))
      .toBe('Anna" onload="alert(document.domain)');
  });

  for (const { label, opts } of RENDER_PATHS) {
    it(`emits no event-handler attribute on any theme: ${label}`, () => {
      for (const theme of THEMES) {
        const doc = parse(renderSite(hostile, theme, opts).html);
        expect(eventHandlers(doc), `${theme.id} / ${label}`).toEqual([]);
      }
    });

    it(`emits only attributes the engine authored: ${label}`, () => {
      for (const theme of THEMES) {
        const doc = parse(renderSite(hostile, theme, opts).html);
        expect(unauthored(doc), `${theme.id} / ${label}`).toEqual([]);
      }
    });
  }

  it('the in-app preview is held to the same rule', () => {
    for (const theme of THEMES) {
      const data: SiteData = { ...hostile, meta: { ...hostile.meta, themeId: theme.id } };
      const doc = parse(previewHtml(data));
      expect(eventHandlers(doc), theme.id).toEqual([]);
      expect(unauthored(doc), theme.id).toEqual([]);
    }
  });

  it('quotes in every attribute-bound field come back out as text, not markup', () => {
    // One explicit statement of the property escAttr exists for, so the reason
    // for the replaceAll cannot be optimised away by someone reading it cold.
    const doc = parse(renderSite(hostile, THEMES[0]!).html);
    for (const attr of attributesOf(doc)) {
      // A value that closed its own quote would have split into two attributes;
      // seeing the quote inside the value proves it did not.
      if (attr.value.includes('"')) expect(attr.value).toMatch(/"/);
    }
    const gallery = [...doc.querySelectorAll('.gallery img')];
    expect(gallery.map((img) => img.getAttribute('alt'))).toEqual([
      'A cat" onmouseup="alert(\'alt\')',
      'Second" onwheel="alert(1)',
    ]);
    // The src is the engine's own asset path here - the gallery image source is
    // never author-controlled on this base - so alt is the attribute under test.
    expect(gallery[0]!.getAttribute('src')).toBe('assets/gallery-5-1.jpg');
    expect([...gallery[0]!.attributes].map((a) => a.name).sort()).toEqual(['alt', 'loading', 'src']);
  });
});
