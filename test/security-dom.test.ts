// @vitest-environment happy-dom
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { previewHtml } from '../src/app/preview.js';
import { decodeShare, encodeShare } from '../src/app/share.js';
import { renderSharedView } from '../src/app/shared-view.js';
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

  it('a share link from a stranger renders inside a frame that can do nothing', () => {
    // The goal: opening someone's #s= link shows their page, and that page -
    // which any third party can craft, byte for byte - cannot run a script and
    // cannot touch this origin, where every saved draft lives in localStorage.
    const crafted: SiteData = {
      ...(full as SiteData),
      name: 'Anna" onload="alert(document.domain)',
      tagline: '<img src=x onerror=alert(1)>',
    };
    const link = encodeShare(crafted, 'https://pageforge.mtclab.net/make');
    const decoded = decodeShare(new URL(link).hash);
    expect(decoded).not.toBeNull();

    renderSharedView(decoded!);
    const frame = document.querySelector('iframe.share-frame') as HTMLIFrameElement | null;
    expect(frame).not.toBeNull();
    // The stranger's page is really in there (an unsandboxed empty frame would
    // pass every assertion below).
    expect(frame!.srcdoc).toContain('Anna&quot; onload=&quot;alert(document.domain)');

    expect(frame!.hasAttribute('sandbox')).toBe(true);
    const tokens = frame!.getAttribute('sandbox')!.split(/\s+/).filter(Boolean);
    expect(tokens).not.toContain('allow-scripts');
    expect(tokens).not.toContain('allow-same-origin');
    expect(tokens).toEqual([]);
  });

  it('every preview frame in the app is sandboxed without allow-scripts', () => {
    // Class gate: any iframe the app fills with rendered site content is a
    // place user data becomes live markup. One created without a sandbox (or
    // with allow-scripts) fails here, in any app file, forever.
    // happy-dom gives import.meta.url an http URL, so anchor on the repo root.
    const dir = `${resolve(process.cwd(), 'src/app')}/`;
    const sources: { file: string; text: string }[] = [];
    const walk = (path: string, prefix: string): void => {
      for (const entry of readdirSync(path, { withFileTypes: true })) {
        if (entry.isDirectory()) walk(`${path}${entry.name}/`, `${prefix}${entry.name}/`);
        else if (entry.name.endsWith('.ts')) {
          sources.push({ file: `${prefix}${entry.name}`, text: readFileSync(`${path}${entry.name}`, 'utf8') });
        }
      }
    };
    walk(dir, '');

    const frames: { file: string; attrs: string }[] = [];
    for (const { file, text } of sources) {
      for (const match of text.matchAll(/el\(\s*'iframe'\s*,\s*\{/g)) {
        const open = match.index! + match[0].length - 1;
        let depth = 0;
        let end = open;
        for (; end < text.length; end++) {
          if (text[end] === '{') depth++;
          else if (text[end] === '}' && --depth === 0) break;
        }
        frames.push({ file, attrs: text.slice(open, end + 1) });
      }
    }
    expect(frames.length).toBeGreaterThanOrEqual(4);
    for (const frame of frames) {
      expect(frame.attrs, `${frame.file}: iframe without sandbox`).toMatch(/\bsandbox\s*:/);
      expect(frame.attrs, `${frame.file}: iframe granting scripts`).not.toContain('allow-scripts');
    }
  });
});
