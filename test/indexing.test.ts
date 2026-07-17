import { beforeEach, describe, expect, it } from 'vitest';
import type { SiteData } from '../src/engine/types.js';
import worker from '../src/worker/index.js';
import { ControlPlane } from '../src/worker/db.js';
import { signSessionCookie } from '../src/worker/session.js';
import minimal from './fixtures/minimal.json';
import { workerEnv } from './worker-fixture.js';

const base = minimal as SiteData;

describe('business indexing', () => {
  let env: ReturnType<typeof workerEnv>;

  beforeEach(async () => {
    env = workerEnv();
    const cp = new ControlPlane(env.DB);
    await cp.createSite({
      publicId: 'publish1',
      approvalKeyHash: 'hash',
      data: { ...base, tagline: 'Julkaistu yritys' },
      actor: 'operator',
    });
    await cp.createSite({
      publicId: 'draft001',
      approvalKeyHash: 'hash',
      data: { ...base, name: 'Luonnos', tagline: 'Ei julkinen' },
      actor: 'operator',
    });
    await env.DB.prepare(
      "UPDATE sites SET status = 'published', updated_at = ? WHERE public_id = 'publish1'",
    ).bind(Date.UTC(2026, 6, 16)).run();
  });

  it('keeps all business pages noindexed and the sitemap unavailable when disabled', async () => {
    const robots = await worker.fetch(new Request('https://example.test/robots.txt'), env);
    expect(await robots.text()).toContain('Disallow: /b/');
    expect((await worker.fetch(new Request('https://example.test/biz-sitemap.xml'), env)).status).toBe(404);

    const page = await worker.fetch(new Request('https://example.test/b/publish1'), env);
    expect(page.headers.get('x-robots-tag')).toBe('noindex');
    expect(await page.text()).toContain('<meta name="robots" content="noindex">');
  });

  it('indexes only published /b pages and lists only published sites when enabled', async () => {
    env.BIZ_INDEXING_ENABLED = 'true';
    const robots = await worker.fetch(new Request('https://example.test/robots.txt'), env);
    expect(await robots.text()).toBe(
      'User-agent: *\nAllow: /b/\nDisallow: /p/\nDisallow: /admin\nSitemap: https://example.test/biz-sitemap.xml',
    );

    const published = await worker.fetch(new Request('https://example.test/b/publish1'), env);
    expect(published.headers.get('x-robots-tag')).toBeNull();
    expect(await published.text()).not.toContain('<meta name="robots" content="noindex">');

    const draft = await worker.fetch(new Request('https://example.test/b/draft001'), env);
    expect(draft.headers.get('x-robots-tag')).toBe('noindex');
    expect(await draft.text()).toContain('<meta name="robots" content="noindex">');

    const session = await signSessionCookie('operator-secret');
    const preview = await worker.fetch(new Request('https://example.test/p/publish1/current', {
      headers: { cookie: `pf_admin=${session.value}` },
    }), env);
    expect(preview.headers.get('x-robots-tag')).toBe('noindex');
    const previewHtml = await preview.text();
    expect(previewHtml).toContain('<meta name="robots" content="noindex">');
    expect(previewHtml).toContain('Luonnos - esikatselu');

    const sitemap = await worker.fetch(new Request('https://example.test/biz-sitemap.xml'), env);
    expect(sitemap.status).toBe(200);
    expect(sitemap.headers.get('content-type')).toBe('application/xml; charset=utf-8');
    const xml = await sitemap.text();
    expect(xml).toContain('<loc>https://example.test/b/publish1</loc><lastmod>2026-07-16</lastmod>');
    expect(xml).not.toContain('draft001');
  });
});
