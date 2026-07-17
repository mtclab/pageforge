import { renderFavicon } from '../engine/favicon.js';
import { effectivePalette, renderSite, resolveFont } from '../engine/render.js';
import { collectImages, type SiteData } from '../engine/types.js';
import { getTheme } from '../themes/index.js';
import { handleBizRequest } from './biz.js';
import { handleMcpRequest } from './mcp.js';
import { type Env, JSON_HEADERS, MAX_BODY, json, sha256Hex } from './shared.js';
import { validateSiteData } from './validate.js';

export { validateSiteData } from './validate.js';

/**
 * Hosted publish (beta). Everything else on this worker is static assets;
 * this code answers only /api/* and /s/* (run_worker_first in wrangler.toml).
 *
 * Design notes:
 * - The server re-renders from SiteData - clients never upload HTML, so a
 *   hostile client cannot host arbitrary markup, only what the escaping
 *   engine emits.
 * - Ownership = an edit key generated at first publish, only its SHA-256
 *   stored. No accounts.
 * - Hosted pages get rel=nofollow on outbound links + a report link (SEO
 *   spam deterrent).
 */

interface StoredSite {
  v: 1;
  data: SiteData;
  editKeyHash: string;
  ogPng?: string; // base64 (no data: prefix)
  publishedAt: number;
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;
const RESERVED = new Set(['api', 's', 'www', 'admin', 'help', 'assets', 'app', 'static', 'pageforge']);
const MAX_IMAGE_B64 = 1_100_000; // ~800 KB binary
const PUBLISHES_PER_DAY = 20;

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const DATA_URL_RE = /^data:image\/(?:jpeg|png);base64,([A-Za-z0-9+/=]+)$/;

async function rateLimit(env: Env, ip: string): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  const key = `rl:${ip}:${day}`;
  const count = Number((await env.SITES.get(key)) ?? '0');
  if (count >= PUBLISHES_PER_DAY) return false;
  await env.SITES.put(key, String(count + 1), { expirationTtl: 90_000 });
  return true;
}

async function handlePublish(request: Request, env: Env): Promise<Response> {
  const length = Number(request.headers.get('content-length') ?? '0');
  if (length > MAX_BODY) return json(413, { error: 'Your page is too large to host here. Photos may be too big.' });

  let body: { slug?: string; editKey?: string; data?: SiteData; ogPng?: string };
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Invalid request.' });
  }

  const slug = (body.slug ?? '').toLowerCase().trim();
  if (!SLUG_RE.test(slug) || RESERVED.has(slug)) {
    return json(400, { error: 'Pick an address with 3-40 letters, numbers or dashes.' });
  }
  if (!body.data) return json(400, { error: 'Missing page data.' });
  const invalid = validateSiteData(body.data);
  if (invalid) return json(400, { error: invalid });

  let ogPng: string | undefined;
  if (body.ogPng) {
    const m = body.ogPng.match(DATA_URL_RE);
    if (!m || m[1]!.length > MAX_IMAGE_B64) return json(400, { error: 'bad og image' });
    ogPng = m[1];
  }

  const existingRaw = await env.SITES.get(`site:${slug}`);
  let editKey = body.editKey?.trim() || '';
  if (existingRaw) {
    const existing = JSON.parse(existingRaw) as StoredSite;
    if (!editKey || (await sha256Hex(editKey)) !== existing.editKeyHash) {
      return json(409, { error: 'That address is taken. Pick another, or use your edit key to update it.' });
    }
  } else {
    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
    if (!(await rateLimit(env, ip))) {
      return json(429, { error: 'Too many new pages today. Try again tomorrow.' });
    }
    if (!editKey) editKey = crypto.randomUUID();
  }

  const stored: StoredSite = {
    v: 1,
    data: body.data,
    editKeyHash: await sha256Hex(editKey),
    ogPng,
    publishedAt: Date.now(),
  };
  await env.SITES.put(`site:${slug}`, JSON.stringify(stored));

  const url = new URL(request.url);
  return json(200, { url: `${url.origin}/s/${slug}/`, editKey });
}

async function handleDelete(request: Request, env: Env, slug: string): Promise<Response> {
  let body: { editKey?: string };
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Invalid request.' });
  }
  const raw = await env.SITES.get(`site:${slug}`);
  if (!raw) return json(404, { error: 'Not found.' });
  const stored = JSON.parse(raw) as StoredSite;
  if (!body.editKey || (await sha256Hex(body.editKey)) !== stored.editKeyHash) {
    return json(403, { error: 'Wrong edit key.' });
  }
  await env.SITES.delete(`site:${slug}`);
  return json(200, { ok: true });
}

function serveSite(request: Request, stored: StoredSite, slug: string, rest: string): Response {
  const url = new URL(request.url);
  const data = stored.data;
  const theme = getTheme(data.meta.themeId);
  const baseUrl = `${url.origin}/s/${slug}`;
  const cache = { 'cache-control': 'public, max-age=300' };

  if (rest === '' || rest === '/') {
    const { html } = renderSite(data, theme, { baseUrl, hosted: true });
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', ...cache } });
  }
  if (rest === '/style.css') {
    const { css } = renderSite(data, theme, { baseUrl, hosted: true });
    return new Response(css, { headers: { 'content-type': 'text/css; charset=utf-8', ...cache } });
  }
  if (rest === '/assets/favicon.svg') {
    const palette = effectivePalette(data, theme);
    const font = resolveFont(theme, data.meta.fontId);
    return new Response(renderFavicon(data.name, palette, font), {
      headers: { 'content-type': 'image/svg+xml', ...cache },
    });
  }
  if (rest === '/assets/og.png' && stored.ogPng) {
    const bytes = b64ToBytes(stored.ogPng);
    const buf = bytes.buffer as ArrayBuffer;
    return new Response(buf, { headers: { 'content-type': 'image/png', ...cache } });
  }
  for (const [path, dataUrl] of collectImages(data)) {
    if (rest === `/${path}`) {
      const m = dataUrl.match(DATA_URL_RE);
      if (!m) break;
      const bytes = b64ToBytes(m[1]!);
      const buf = bytes.buffer as ArrayBuffer;
      const type = dataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
      return new Response(buf, { headers: { 'content-type': type, ...cache } });
    }
  }
  return new Response('Not found', { status: 404 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // Public build stamp: what commit is live + when it deployed. Populated by
    // the deploy workflow; falls back to "dev" for local `wrangler dev`.
    if (pathname === '/version') {
      return new Response(
        JSON.stringify({ commit: env.BUILD_COMMIT ?? 'dev', deployed_at: env.BUILD_TIME ?? null }),
        { headers: { ...JSON_HEADERS, 'cache-control': 'no-store' } },
      );
    }

    const mutationPath = pathname === '/api/mcp'
      || pathname.startsWith('/api/biz/')
      || pathname.startsWith('/p/')
      || pathname.startsWith('/b/')
      || pathname.startsWith('/img/');
    if (mutationPath) {
      if (env.MUTATION_API_ENABLED !== 'true' || !env.OPERATOR_KEY) {
        return new Response('Not found', { status: 404 });
      }
      if (pathname === '/api/mcp') return handleMcpRequest(request, env);
      return handleBizRequest(request, env);
    }

    if (pathname.startsWith('/api/') && env.PUBLISH_ENABLED !== 'true') {
      return json(503, { error: 'Hosting here is not open yet. Download the zip - the README gets you online in minutes.' });
    }

    if (pathname === '/api/check' && request.method === 'GET') {
      const slug = (url.searchParams.get('slug') ?? '').toLowerCase().trim();
      if (!SLUG_RE.test(slug) || RESERVED.has(slug)) return json(200, { available: false, invalid: true });
      const exists = await env.SITES.get(`site:${slug}`);
      return json(200, { available: !exists });
    }
    if (pathname === '/api/publish' && request.method === 'POST') {
      return handlePublish(request, env);
    }
    const delMatch = pathname.match(/^\/api\/site\/([a-z0-9-]+)$/);
    if (delMatch && request.method === 'DELETE') {
      return handleDelete(request, env, delMatch[1]!);
    }

    const siteMatch = pathname.match(/^\/s\/([a-z0-9-]+)(\/.*)?$/);
    if (siteMatch) {
      const slug = siteMatch[1]!;
      const rest = siteMatch[2] ?? '';
      if (rest === '') {
        return Response.redirect(`${url.origin}/s/${slug}/`, 301);
      }
      const raw = await env.SITES.get(`site:${slug}`);
      if (!raw) {
        return new Response('This page does not exist (or was removed).', {
          status: 404,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        });
      }
      return serveSite(request, JSON.parse(raw) as StoredSite, slug, rest);
    }

    // Everything else: static assets (the generator app itself)
    return env.ASSETS.fetch(request);
  },
};
