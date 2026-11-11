import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import { previewHtml } from '../src/app/preview.js';
import { EMAIL_ACTIVATION_SCRIPT } from '../src/engine/links.js';
import { renderSite } from '../src/engine/render.js';
import type { SiteData } from '../src/engine/types.js';
import { getTheme } from '../src/themes/index.js';
import worker from '../src/worker/index.js';
import { APP_CSP, HOSTED_CSP } from '../src/worker/security.js';

/**
 * #52: the live site sent no CSP/HSTS/nosniff/frame/referrer headers, the 404
 * was an empty body, and the sitemap listed a URL that redirects.
 *
 * These gates assert the visitor-facing outcome: every response the worker can
 * produce carries the headers, the CSP admits everything the pages actually
 * load (so the headers do not break the product), and unknown paths reach a
 * real page.
 */

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const ORIGIN = 'https://pageforge.mtclab.net';
const REQUIRED = [
  'content-security-policy',
  'strict-transport-security',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
] as const;

// ------------------------------------------------------------ CSP evaluation
type Policy = Map<string, string[]>;

function parseCsp(csp: string): Policy {
  const policy: Policy = new Map();
  for (const part of csp.split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) policy.set(name.toLowerCase(), sources);
  }
  return policy;
}

function sourcesFor(policy: Policy, directive: string): string[] {
  return policy.get(directive) ?? policy.get('default-src') ?? [];
}

/** Does `directive` admit a fetch of `url` (resolved against the page URL)? */
function admitsUrl(policy: Policy, directive: string, url: string, pageUrl: string): boolean {
  const target = new URL(url, pageUrl);
  return sourcesFor(policy, directive).some((src) => {
    if (src === "'self'") return target.origin === ORIGIN;
    if (/^[a-z][a-z0-9+.-]*:$/.test(src)) return target.protocol === src;
    if (src.startsWith("'")) return false;
    return target.host === src.replace(/^https?:\/\//, '');
  });
}

function sha256(text: string): string {
  return `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;
}

/** Inline content is admitted by its hash, or by 'unsafe-inline' when the list holds no hash/nonce. */
function admitsInline(policy: Policy, directive: string, text: string): boolean {
  const sources = sourcesFor(policy, directive);
  if (sources.includes(sha256(text))) return true;
  const hasHashOrNonce = sources.some((s) => /^'(sha\d+|nonce)-/.test(s));
  return sources.includes("'unsafe-inline'") && !hasHashOrNonce;
}

interface Violation { page: string; what: string }

// A parser that never fetches or runs anything: this suite runs in node so the
// worker sees the platform Request/Response, and pages are only inspected.
const parserWindow = new Window({
  settings: {
    disableCSSFileLoading: true,
    disableJavaScriptFileLoading: true,
    disableJavaScriptEvaluation: true,
    disableIframePageLoading: true,
  },
});
function parseHtml(html: string): Document {
  return new parserWindow.DOMParser().parseFromString(html, 'text/html') as unknown as Document;
}

/**
 * Every subresource and inline block a document carries, checked against the
 * policy. `scriptsRun` is false only for sandboxed preview frames that grant
 * no allow-scripts (their scripts never execute; asserted separately).
 */
function auditDocument(page: string, html: string, csp: string, pageUrl: string, scriptsRun = true): Violation[] {
  const policy = parseCsp(csp);
  const doc = parseHtml(html);
  const out: Violation[] = [];
  const fail = (what: string) => out.push({ page, what });

  for (const s of doc.querySelectorAll('script')) {
    const type = (s.getAttribute('type') ?? '').toLowerCase();
    if (type && type !== 'module' && type !== 'text/javascript') continue; // data blocks (ld+json) never execute
    if (!scriptsRun) continue;
    const src = s.getAttribute('src');
    if (src) {
      if (!admitsUrl(policy, 'script-src', src, pageUrl)) fail(`script ${src}`);
    } else if (!admitsInline(policy, 'script-src', s.textContent ?? '')) {
      fail(`inline script ${sha256(s.textContent ?? '')}`);
    }
  }
  for (const l of doc.querySelectorAll('link[href]')) {
    const rel = (l.getAttribute('rel') ?? '').toLowerCase();
    const href = l.getAttribute('href')!;
    if (rel === 'stylesheet' && !admitsUrl(policy, 'style-src', href, pageUrl)) fail(`stylesheet ${href}`);
    if (rel === 'icon' && !admitsUrl(policy, 'img-src', href, pageUrl)) fail(`icon ${href}`);
    if (rel === 'preload' || rel === 'modulepreload') fail(`unaudited ${rel} ${href}`);
  }
  for (const st of doc.querySelectorAll('style')) {
    if (!admitsInline(policy, 'style-src', st.textContent ?? '')) fail('inline <style>');
    for (const m of (st.textContent ?? '').matchAll(/url\(\s*['"]?([^'")]+)/g)) {
      if (!admitsUrl(policy, 'img-src', m[1]!, pageUrl)) fail(`css url ${m[1]}`);
    }
  }
  for (const e of doc.querySelectorAll('[style]')) {
    if (!admitsInline(policy, 'style-src', e.getAttribute('style') ?? '')) fail('style attribute');
  }
  for (const img of doc.querySelectorAll('img[src]')) {
    const src = img.getAttribute('src')!;
    if (!admitsUrl(policy, 'img-src', src, pageUrl)) fail(`img ${src.slice(0, 40)}`);
  }
  for (const f of doc.querySelectorAll('iframe[src]')) {
    const src = f.getAttribute('src')!;
    if (!admitsUrl(policy, 'frame-src', src, pageUrl)) fail(`iframe ${src}`);
  }
  return out;
}

const fixture = JSON.parse(read('test/fixtures/full.json')) as SiteData;
const STATIC_PAGES = readdirSync(resolve(process.cwd(), 'src/static')).filter((f) => f.endsWith('.html'));

describe('CSP admits everything the app pages load', () => {
  it('covers the pages that exist (index, make, help, 404)', () => {
    expect(STATIC_PAGES.sort()).toEqual(['404.html', 'help.html', 'index.html', 'make.html']);
  });

  for (const file of STATIC_PAGES) {
    it(`${file}: every script, stylesheet, icon, image and inline block is admitted`, () => {
      const path = file === 'index.html' ? '/' : `/${file.replace(/\.html$/, '')}`;
      expect(auditDocument(file, read(`src/static/${file}`), APP_CSP, ORIGIN + path)).toEqual([]);
    });
  }

  it('the 404 page loads its stylesheet and icon from the root, so it works at any depth', () => {
    const v = auditDocument('404 at depth', read('src/static/404.html'), APP_CSP, `${ORIGIN}/a/b/c`);
    expect(v).toEqual([]);
    const doc = parseHtml(read('src/static/404.html'));
    for (const l of doc.querySelectorAll('link[href]')) expect(l.getAttribute('href')).toMatch(/^\//);
  });

  it('ui.css loads nothing the CSP refuses (fonts are system stacks)', () => {
    const css = read('src/app/ui.css');
    expect(css).not.toMatch(/@font-face|@import/);
    for (const m of css.matchAll(/url\(\s*['"]?([^'")]+)/g)) {
      expect(admitsUrl(parseCsp(APP_CSP), 'img-src', m[1]!, ORIGIN)).toBe(true);
    }
  });

  it('the app talks only to its own origin (connect-src self covers every fetch)', () => {
    const files = readdirSync(resolve(process.cwd(), 'src/app'), { recursive: true }) as string[];
    for (const f of files.filter((x) => x.endsWith('.ts'))) {
      const src = read(`src/app/${f}`);
      for (const m of src.matchAll(/fetch\(\s*[`'"]([^`'"]*)/g)) {
        expect(admitsUrl(parseCsp(APP_CSP), 'connect-src', m[1]!, `${ORIGIN}/make`), `${f}: ${m[1]}`).toBe(true);
      }
    }
  });

  it('live previews (srcdoc, which inherits the app CSP) load their styles and data-URL images', () => {
    const doc = previewHtml(fixture);
    expect(doc).toContain('<style>');
    expect(doc).toContain('src="data:image/jpeg');
    expect(auditDocument('preview', doc, APP_CSP, `${ORIGIN}/make`, false)).toEqual([]);
  });

  it('every preview iframe is sandboxed without allow-scripts (their inline scripts never run)', () => {
    const sandboxes: string[] = [];
    const files = readdirSync(resolve(process.cwd(), 'src/app'), { recursive: true }) as string[];
    for (const f of files.filter((x) => x.endsWith('.ts'))) {
      const src = read(`src/app/${f}`);
      const frames = [...src.matchAll(/el\('iframe',\s*\{([\s\S]*?)\}\)/g)];
      expect(frames.length, `${f}: every iframe is built with el('iframe', {...})`).toBe(src.match(/'iframe'/g)?.length ?? 0);
      for (const fr of frames) {
        const sb = fr[1]!.match(/sandbox:\s*'([^']*)'/);
        expect(sb, `${f}: iframe without sandbox`).not.toBeNull();
        sandboxes.push(sb![1]!);
      }
    }
    for (const m of read('src/static/make.html').matchAll(/<iframe[^>]*sandbox="([^"]*)"/g)) sandboxes.push(m[1]!);
    expect(sandboxes.length).toBeGreaterThanOrEqual(5);
    for (const s of sandboxes) expect(s).not.toContain('allow-scripts');
  });

  it('the print-cards window writes no inline script (about:blank inherits the CSP)', () => {
    expect(read('src/app/qr.ts')).not.toMatch(/<script/i);
  });
});

describe('CSP admits everything a hosted page loads', () => {
  it('hosted render: stylesheet, icon, images and the email script are admitted', () => {
    const base = `${ORIGIN}/s/anna`;
    const { html } = renderSite(fixture, getTheme('slate'), { baseUrl: base, hosted: true });
    expect(html).toContain('data-email-a=');
    expect(auditDocument('hosted', html, HOSTED_CSP, `${base}/`)).toEqual([]);
  });

  it('the pinned email-script hash is the hash of the script the engine emits', () => {
    const body = EMAIL_ACTIVATION_SCRIPT.replace(/^<script>/, '').replace(/<\/script>$/, '');
    expect(parseCsp(HOSTED_CSP).get('script-src')).toContain(sha256(body));
  });

  it('hosted pages may run no other script and load nothing cross-origin', () => {
    const policy = parseCsp(HOSTED_CSP);
    expect(policy.get('default-src')).toEqual(["'none'"]);
    expect(admitsUrl(policy, 'script-src', '/app.js', `${ORIGIN}/s/anna/`)).toBe(false);
    expect(admitsUrl(policy, 'img-src', 'https://evil.example/x.png', `${ORIGIN}/s/anna/`)).toBe(false);
  });
});

// ------------------------------------------------------------- every route
const stored = JSON.stringify({ v: 1, data: fixture, editKeyHash: 'x', publishedAt: 0 });

function fakeEnv(publish: boolean) {
  const kv = new Map<string, string>([['site:anna', stored]]);
  return {
    PUBLISH_ENABLED: publish ? 'true' : 'false',
    SITES: {
      get: async (k: string) => kv.get(k) ?? null,
      put: async (k: string, v: string) => { kv.set(k, v); },
      delete: async (k: string) => { kv.delete(k); },
    },
    // Static assets as Workers Assets returns them: bare, with no security headers.
    ASSETS: {
      fetch: async (req: Request) => {
        const path = new URL(req.url).pathname;
        const known = ['/', '/make', '/help', '/app.js', '/landing.js', '/ui.css', '/sitemap.xml', '/robots.txt', '/og.png', '/favicon.svg'];
        return known.includes(path)
          ? new Response('asset', { status: 200, headers: { 'content-type': 'text/html' } })
          : new Response('<h1>404 page</h1>', { status: 404, headers: { 'content-type': 'text/html' } });
      },
    },
  };
}

const ROUTES: [string, string, string?][] = [
  ['GET', '/'],
  ['GET', '/make'],
  ['GET', '/help'],
  ['GET', '/app.js'],
  ['GET', '/ui.css'],
  ['GET', '/sitemap.xml'],
  ['GET', '/og.png'],
  ['GET', '/no-such-page'],
  ['GET', '/version'],
  ['POST', '/api/publish', '{}'],
  ['GET', '/api/check?slug=anna'],
  ['DELETE', '/api/site/anna', '{}'],
  ['GET', '/s/anna'],
  ['GET', '/s/anna/'],
  ['GET', '/s/anna/style.css'],
  ['GET', '/s/anna/assets/favicon.svg'],
  ['GET', '/s/anna/nope'],
  ['GET', '/s/missing/'],
];

describe('every response carries the security headers', () => {
  for (const publish of [false, true]) {
    for (const [method, path, body] of ROUTES) {
      it(`${method} ${path} (publish ${publish ? 'open' : 'closed'})`, async () => {
        const req = new Request(ORIGIN + path, { method, body, headers: { 'content-type': 'application/json' } });
        const res = await worker.fetch(req, fakeEnv(publish) as never);
        for (const h of REQUIRED) expect(res.headers.get(h), h).toBeTruthy();
        expect(res.headers.get('x-content-type-options')).toBe('nosniff');
        expect(res.headers.get('x-frame-options')).toBe('DENY');
        expect(res.headers.get('strict-transport-security')).toMatch(/max-age=\d{7,}/);
        expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
        const csp = parseCsp(res.headers.get('content-security-policy')!);
        expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
        expect(res.headers.get('content-security-policy')).toBe(path.startsWith('/s/') ? HOSTED_CSP : APP_CSP);
      });
    }
  }

  it('static assets pass through the worker, so they get the headers too', () => {
    const toml = read('wrangler.toml');
    expect(toml).toMatch(/^run_worker_first\s*=\s*true\s*$/m);
  });
});

describe('404 and sitemap', () => {
  it('unknown paths serve the designed 404 page with status 404', async () => {
    expect(read('wrangler.toml')).toMatch(/^not_found_handling\s*=\s*"404-page"\s*$/m);
    expect(existsSync(resolve(process.cwd(), 'src/static/404.html'))).toBe(true);
    const doc = parseHtml(read('src/static/404.html'));
    expect(doc.querySelectorAll('h1').length).toBe(1);
    const hrefs = [...doc.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/make');
    expect(hrefs).toContain('/');
    expect(doc.querySelector('.maker-mark a[href="https://mtclab.net"]')).not.toBeNull();
    const res = await worker.fetch(new Request(`${ORIGIN}/no-such-page`), fakeEnv(false) as never);
    expect(res.status).toBe(404);
  });

  it('the sitemap lists only canonical URLs (no .html that redirects)', () => {
    const locs = [...read('src/static/sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual([`${ORIGIN}/`, `${ORIGIN}/make`, `${ORIGIN}/help`]);
  });

  it('every sitemap URL is the canonical its own page declares', () => {
    for (const [file, url] of [['index.html', `${ORIGIN}/`], ['make.html', `${ORIGIN}/make`], ['help.html', `${ORIGIN}/help`]]) {
      const doc = parseHtml(read(`src/static/${file}`));
      expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href'), file).toBe(url);
      expect(doc.querySelector('meta[property="og:url"]')?.getAttribute('content'), file).toBe(url);
    }
  });

  it('no page links to a .html path that redirects', () => {
    for (const file of STATIC_PAGES) {
      expect(read(`src/static/${file}`), file).not.toMatch(/href="[^"]*\.html"/);
    }
    expect(read('src/app/steps/download.ts')).not.toMatch(/linkEl\('[^']*\.html'/);
  });
});
