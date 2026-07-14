// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { previewHtml } from '../src/app/preview.js';
import { renderSite } from '../src/engine/render.js';
import type { SiteData } from '../src/engine/types.js';
import { THEMES } from '../src/themes/index.js';
import full from './fixtures/full.json';
import hostile from './fixtures/hostile.json';
import hostileImage from './fixtures/hostile-image.json';

function parse(html: string): Document {
  return new DOMParser().parseFromString(
    html.replace('<link rel="stylesheet" href="style.css">', ''),
    'text/html',
  );
}

describe('parsed DOM security boundaries', () => {
  it('hostile surface and photo shape cannot create body attributes', () => {
    const doc = parse(renderSite(hostile as unknown as SiteData, THEMES[0]!).html);
    expect([...doc.body.attributes].map((attr) => attr.name)).toEqual(['class']);
    expect(doc.body.hasAttribute('autofocus')).toBe(false);
    expect(doc.body.hasAttribute('data-injected')).toBe(false);
    expect(doc.body.classList.contains('photo-circle')).toBe(true);
  });

  it('hostile image data cannot inject preview attributes', () => {
    const doc = parse(previewHtml(hostileImage as unknown as SiteData));
    expect(doc.querySelector('[onerror]')).toBeNull();
    expect(doc.querySelector('[loading="eager"]')).toBeNull();
    expect(doc.querySelector('.photo')?.getAttribute('src')).toBe('assets/photo.jpg');
  });

  it('a complete email address is absent from source, text, and attributes', () => {
    const html = renderSite(full as SiteData, THEMES[0]!).html;
    expect(html).not.toContain('anna@example.com');
    const doc = parse(html);
    expect(doc.body.textContent).not.toContain('anna@example.com');
    const email = doc.querySelector<HTMLElement>('[data-email-a][data-email-b]')!;
    expect(`${email.dataset.emailA}${email.dataset.emailB}`).toBe('mailto:anna@example.com');
    for (const element of doc.querySelectorAll('*')) {
      for (const attr of element.attributes) expect(attr.value).not.toContain('anna@example.com');
    }
  });
});
