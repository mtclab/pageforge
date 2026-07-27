// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The front door.
 *
 * Until 2026-07-27 "/" served the builder itself: a cold visitor's first
 * screen was an empty form asking their name, the site had no <h1> anywhere,
 * and the one claim the competition structurally cannot match - you download
 * the whole site and it is yours - existed only in a <meta description>.
 *
 * These gates assert the visitor's outcome (they can read what this is and
 * get to the builder), not that a file exists.
 */

// happy-dom rewrites import.meta.url, so resolve from the repo root vitest runs in.
function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const landingHtml = read('src/static/index.html');
const makeHtml = read('src/static/make.html');

function parse(html: string): Document {
  // drop the stylesheet link: happy-dom would try to fetch it over the network
  return new DOMParser().parseFromString(html.replace(/<link rel="stylesheet"[^>]*>/g, ''), 'text/html');
}

const landing = parse(landingHtml);

describe('landing page at /', () => {
  it('leads with exactly one h1 that says what this is', () => {
    const h1s = landing.querySelectorAll('h1');
    expect(h1s.length).toBe(1);
    expect(h1s[0]!.textContent!.trim().length).toBeGreaterThan(8);
  });

  it('makes the ownership claim in readable copy, not only in meta tags', () => {
    const body = landing.body.textContent!.toLowerCase();
    expect(body).toContain('zip');
    expect(body).toContain('no account');
    expect(body).toContain('no subscription');
    // the claim has to survive stripping every <meta>
    const withoutMeta = landingHtml.replace(/<meta[^>]*>/g, '');
    expect(withoutMeta.toLowerCase()).toContain('yours');
  });

  it('sends the visitor to the builder', () => {
    const toMake = [...landing.querySelectorAll('a[href]')]
      .filter((a) => (a.getAttribute('href') ?? '').startsWith('/make'));
    expect(toMake.length).toBeGreaterThanOrEqual(2);
  });

  it('shows the looks instead of describing them', () => {
    expect(landing.querySelector('#look-grid')).not.toBeNull();
    expect(landing.querySelector('#hero-sheets')).not.toBeNull();
    expect(landingHtml).toContain('landing.js');
  });

  it('carries the maker mark', () => {
    const footer = landing.querySelector('.site-footer')!;
    expect(footer.textContent).toContain('MTC Lab');
    expect(footer.querySelector('a[href="https://mtclab.net"]')).not.toBeNull();
  });
});

describe('old links keep working', () => {
  /** The inline forwarder runs before anything renders; test the rule it applies. */
  const forwarder = landingHtml.match(/<script>([\s\S]*?)<\/script>/)![1]!;
  const ownAnchors = forwarder.match(/\/\^#\(([a-z|]+)\)\$\//)![1]!.split('|');
  const isOwnAnchor = new RegExp(`^#(${ownAnchors.join('|')})$`);

  it('hands share links and the theme workbench to the builder', () => {
    expect(forwarder).toContain('location.replace');
    expect(forwarder).toContain("'/make'");
    for (const hash of ['#s=abc123_-', '#gallery', '#look=linen']) {
      expect(isOwnAnchor.test(hash), `${hash} must be forwarded`).toBe(false);
    }
  });

  it('does not forward the landing page to itself', () => {
    for (const anchor of [...landing.querySelectorAll('a[href^="#"]')]) {
      const hash = anchor.getAttribute('href')!;
      expect(isOwnAnchor.test(hash), `${hash} is a landing anchor, not a builder link`).toBe(true);
    }
  });
});

describe('builder at /make', () => {
  it('is a whole page with the wizard mounted', () => {
    const make = parse(makeHtml);
    expect(make.querySelector('#pane')).not.toBeNull();
    expect(make.querySelector('#preview-frame')).not.toBeNull();
    expect(make.querySelector('#steps')).not.toBeNull();
    expect(makeHtml).toContain('app.js');
  });

  it('links home and carries the maker mark', () => {
    const make = parse(makeHtml);
    expect(make.querySelector('.brand')!.getAttribute('href')).toBe('/');
    expect(make.querySelector('.app-footer')!.textContent).toContain('MTC Lab');
  });

  it('is what the build actually ships', () => {
    const build = read('scripts/build.mjs');
    expect(build).toContain('src/app/main.ts');
    expect(build).toContain('src/app/landing.ts');
  });
});
