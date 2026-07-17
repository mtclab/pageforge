import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SiteData } from '../src/engine/types.js';
import worker from '../src/worker/index.js';
import { ControlPlane } from '../src/worker/db.js';
import { sha256Hex } from '../src/worker/shared.js';
import { signSessionCookie } from '../src/worker/session.js';
import minimal from './fixtures/minimal.json';
import { jsonRequest, MemoryKV, workerEnv } from './worker-fixture.js';

const base = minimal as SiteData;
const operatorKey = 'operator-secret';

function data(name: string): SiteData {
  return { ...base, name, tagline: `${name} tagline`, lang: 'fi' };
}

function formRequest(path: string, fields: Record<string, string>, cookie?: string): Request {
  return new Request(`https://example.test${path}`, {
    method: 'POST',
    headers: cookie ? { cookie } : undefined,
    body: new URLSearchParams(fields),
  });
}

describe('S5 draft versioning', () => {
  let env: ReturnType<typeof workerEnv>;
  let cp: ControlPlane;

  beforeEach(() => {
    env = workerEnv();
    cp = new ControlPlane(env.DB);
  });

  async function seedSite(publicId: string, name = publicId): Promise<void> {
    await cp.createSite({
      publicId,
      approvalKeyHash: await sha256Hex('approval-secret'),
      data: data(name),
      actor: 'operator',
    });
  }

  async function seedProposal(siteId: string, proposalId: string, name: string): Promise<void> {
    const site = (await cp.getSiteByPublicId(siteId))!;
    await cp.createProposal({
      site,
      publicId: proposalId,
      candidate: data(name),
      summary: ['name changed'],
      actor: 'operator',
    });
  }

  it('stores only auto-token hashes and requires the returned tokenized URL', async () => {
    await seedSite('autotok1', 'Original');
    const response = await worker.fetch(
      jsonRequest(
        '/api/biz/sites/autotok1/proposals',
        'POST',
        { candidate: data('Candidate') },
        operatorKey,
      ),
      env,
    );
    expect(response.status).toBe(200);
    const proposal = await response.json() as { proposalId: string; previewPath: string };
    const url = new URL(proposal.previewPath, 'https://example.test');
    const token = url.searchParams.get('t')!;
    expect(token).toMatch(/^[a-f0-9]{32}$/);

    const row = await env.DB.prepare(
      'SELECT token_hash, proposal_public_id, label FROM preview_tokens WHERE site_id = (SELECT id FROM sites WHERE public_id = ?)',
    ).bind('autotok1').first<{
      token_hash: string;
      proposal_public_id: string;
      label: string;
    }>();
    expect(row).toEqual({
      token_hash: await sha256Hex(token),
      proposal_public_id: proposal.proposalId,
      label: 'auto',
    });
    expect(row!.token_hash).not.toContain(token);
    expect((await worker.fetch(new Request(url.origin + url.pathname), env)).status).toBe(404);
    expect((await worker.fetch(new Request(url), env)).status).toBe(200);
  });

  it('enforces expiry, revocation, wrong-site, and proposal scope with 404s', async () => {
    await seedSite('tokens01');
    await seedSite('tokens02');
    await seedProposal('tokens01', 'scope001', 'Scoped one');
    await seedProposal('tokens01', 'scope002', 'Scoped two');
    const site = (await cp.getSiteByPublicId('tokens01'))!;

    const scoped = '11111111111111111111111111111111';
    await cp.createPreviewToken({
      tokenHash: await sha256Hex(scoped),
      site,
      proposalPublicId: 'scope001',
      label: 'scoped',
      expiresAt: Date.now() + 60_000,
      actor: 'operator',
    });
    expect((await worker.fetch(new Request(`https://example.test/p/tokens01/scope001?t=${scoped}`), env)).status).toBe(200);
    expect((await worker.fetch(new Request(`https://example.test/p/tokens01/scope002?t=${scoped}`), env)).status).toBe(404);

    const siteWide = '22222222222222222222222222222222';
    const tokenId = await cp.createPreviewToken({
      tokenHash: await sha256Hex(siteWide),
      site,
      label: 'site-wide',
      expiresAt: Date.now() + 60_000,
      actor: 'operator',
    });
    expect((await worker.fetch(new Request(`https://example.test/p/tokens01/current?t=${siteWide}`), env)).status).toBe(200);
    expect((await worker.fetch(new Request(`https://example.test/p/tokens02/current?t=${siteWide}`), env)).status).toBe(404);
    expect(await cp.revokePreviewToken({ id: tokenId, site, actor: 'operator' })).toBe(true);
    expect((await worker.fetch(new Request(`https://example.test/p/tokens01/current?t=${siteWide}`), env)).status).toBe(404);

    const expired = '33333333333333333333333333333333';
    await cp.createPreviewToken({
      tokenHash: await sha256Hex(expired),
      site,
      proposalPublicId: 'scope001',
      label: 'expired',
      expiresAt: Date.now() - 1,
      actor: 'operator',
    });
    const expiredResponse = await worker.fetch(
      new Request(`https://example.test/p/tokens01/scope001?t=${expired}`),
      env,
    );
    expect(expiredResponse.status).toBe(404);
    expect(await cp.listActiveTokens(site.id)).toHaveLength(1);

    const session = await signSessionCookie(operatorKey);
    const operatorPreview = await worker.fetch(
      new Request('https://example.test/p/tokens01/scope002', {
        headers: { cookie: `pf_admin=${session.value}` },
      }),
      env,
    );
    expect(operatorPreview.status).toBe(200);
  });

  it('accepts double-submit comments, attributes authors, caps at 20, and escapes console output', async () => {
    await seedSite('comment1');
    await seedProposal('comment1', 'commentp', 'Comment candidate');
    const site = (await cp.getSiteByPublicId('comment1'))!;
    const token = '44444444444444444444444444444444';
    await cp.createPreviewToken({
      tokenHash: await sha256Hex(token),
      site,
      proposalPublicId: 'commentp',
      label: 'comments',
      expiresAt: Date.now() + 60_000,
      actor: 'operator',
    });
    const previewPath = `/p/comment1/commentp?t=${token}`;
    const preview = await worker.fetch(new Request(`https://example.test${previewPath}`), env);
    const previewHtml = await preview.text();
    expect(previewHtml).toContain('name="body"');
    expect(previewHtml).toContain(`name="t" value="${token}"`);

    const rejected = await worker.fetch(
      formRequest(`/p/comment1/commentp/comments?t=${token}`, { t: 'wrong', body: 'Forged' }),
      env,
    );
    expect(rejected.status).toBe(404);
    expect(await cp.listDraftComments(site.id)).toHaveLength(0);

    const hostile = '<img src=x onerror=alert(1)>';
    const posted = await worker.fetch(
      formRequest(`/p/comment1/commentp/comments?t=${token}`, { t: token, body: hostile }),
      env,
    );
    expect(posted.status).toBe(303);
    expect(posted.headers.get('location')).toBe(previewPath);
    expect(await cp.listDraftComments(site.id)).toEqual([
      expect.objectContaining({
        proposalPublicId: 'commentp',
        author: 'customer',
        body: hostile,
      }),
    ]);

    for (let index = 1; index < 20; index++) {
      const response = await worker.fetch(
        formRequest(`/p/comment1/commentp/comments?t=${token}`, {
          t: token,
          body: `Comment ${index}`,
        }),
        env,
      );
      expect(response.status).toBe(303);
    }
    expect((await worker.fetch(
      formRequest(`/p/comment1/commentp/comments?t=${token}`, { t: token, body: 'Too many' }),
      env,
    )).status).toBe(429);

    const session = await signSessionCookie(operatorKey);
    const cookie = `pf_admin=${session.value}`;
    const operatorComment = await worker.fetch(
      formRequest('/p/comment1/current/comments', { t: '', body: 'Operator note' }, cookie),
      env,
    );
    expect(operatorComment.status).toBe(303);
    expect((await cp.listDraftComments(site.id))[0]).toEqual(
      expect.objectContaining({ author: 'operator', body: 'Operator note' }),
    );

    const detail = await worker.fetch(new Request('https://example.test/admin/sites/comment1', {
      headers: { cookie },
    }), env);
    const detailHtml = await detail.text();
    expect(detailHtml).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(detailHtml).not.toContain('<img src=x');
    const audit = await cp.listAuditEvents({ entity: 'proposal', entityId: 'commentp', limit: 30 });
    expect(audit).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'comment.create', detail: { proposal: 'commentp', author: 'customer' } }),
    ]));
  });

  it('creates a console token once, lists it without plaintext, and revokes it', async () => {
    await seedSite('console1');
    await seedProposal('console1', 'consolep', 'Console proposal');
    const session = await signSessionCookie(operatorKey);
    const cookie = `pf_admin=${session.value}`;
    const detail = await worker.fetch(new Request('https://example.test/admin/sites/console1', {
      headers: { cookie },
    }), env);
    const detailHtml = await detail.text();
    const csrf = detailHtml.match(/name="csrf" value="([a-f0-9]{64})"/)![1]!;
    const created = await worker.fetch(formRequest('/admin/sites/console1/tokens', {
      csrf,
      label: 'Asiakkaan linkki',
      days: '7',
      proposal: 'consolep',
    }, cookie), env);
    expect(created.status).toBe(200);
    const createdHtml = await created.text();
    const token = createdHtml.match(/\?t=([a-f0-9]{32})/)![1]!;
    expect(createdHtml).toContain('Linkki näytetään vain tämän kerran');

    const row = await env.DB.prepare(
      'SELECT id, token_hash FROM preview_tokens WHERE label = ?',
    ).bind('Asiakkaan linkki').first<{ id: number; token_hash: string }>();
    expect(row!.token_hash).toBe(await sha256Hex(token));
    const listed = await worker.fetch(new Request('https://example.test/admin/sites/console1', {
      headers: { cookie },
    }), env);
    const listedHtml = await listed.text();
    expect(listedHtml).toContain('Asiakkaan linkki');
    expect(listedHtml).not.toContain(token);

    const revoked = await worker.fetch(
      formRequest(`/admin/sites/console1/tokens/${row!.id}/revoke`, { csrf }, cookie),
      env,
    );
    expect(revoked.status).toBe(303);
    expect(await cp.listActiveTokens((await cp.getSiteByPublicId('console1'))!.id)).toHaveLength(0);
    const audit = await cp.listAuditEvents({ entity: 'site', entityId: 'console1', limit: 20 });
    expect(audit.map((event) => event.action)).toEqual(expect.arrayContaining([
      'token.create',
      'token.revoke',
    ]));
  });

  it('serves the selected immutable snapshot, invalidates cache keys, and unpublishes to current', async () => {
    await seedSite('publish1', 'Version one');
    await seedProposal('publish1', 'publishp', 'Version two');
    const v1Site = (await cp.getSiteByPublicId('publish1'))!;
    const proposal = (await cp.getProposal(v1Site.id, 'publishp'))!;
    await cp.approveProposal(v1Site, proposal, {
      actor: 'operator',
      action: 'proposal.approve',
      entity: 'site',
      entityId: 'publish1',
    });
    const approved = (await cp.getSiteByPublicId('publish1'))!;
    expect(approved.status).toBe('approved');
    expect(approved.data.name).toBe('Version two');

    const live = await worker.fetch(new Request('https://example.test/b/publish1'), env);
    expect(await live.text()).toContain('Version two');
    const published = await worker.fetch(
      jsonRequest('/api/biz/sites/publish1/publish', 'POST', { n: 1 }, 'approval-secret'),
      env,
    );
    expect(published.status).toBe(200);
    expect(await published.json()).toEqual({ ok: true, version: 1 });
    const exact = await worker.fetch(new Request('https://example.test/b/publish1'), env);
    const exactHtml = await exact.text();
    expect(exactHtml).toContain('Version one');
    expect(exactHtml).not.toContain('Version two');
    expect((env.SITES as MemoryKV).values.has('bizhtml:publish1:1:live:noindex')).toBe(true);
    expect((env.SITES as MemoryKV).values.has('bizhtml:publish1:1:1:noindex')).toBe(true);

    const unpublished = await worker.fetch(
      jsonRequest('/api/biz/sites/publish1/unpublish', 'POST', {}, operatorKey),
      env,
    );
    expect(unpublished.status).toBe(200);
    expect(await (await worker.fetch(new Request('https://example.test/b/publish1'), env)).text()).toContain('Version two');
    const current = (await cp.getSiteByPublicId('publish1'))!;
    expect(current.publishedVersion).toBeUndefined();
    expect(current.status).toBe('approved');
    const audit = await cp.listAuditEvents({ entity: 'site', entityId: 'publish1', limit: 20 });
    expect(audit).toEqual(expect.arrayContaining([
      expect.objectContaining({ actor: 'approval-key', action: 'site.publish', detail: { n: 1 } }),
      expect.objectContaining({ actor: 'operator', action: 'site.unpublish' }),
    ]));
  });

  it('logs a dangling published pointer and safely falls back to current data', async () => {
    await seedSite('dangling', 'Current data');
    await env.DB.prepare(
      "UPDATE sites SET published_version = 99, status = 'published' WHERE public_id = 'dangling'",
    ).run();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const response = await worker.fetch(new Request('https://example.test/b/dangling'), env);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('Current data');
      expect(logged).toHaveBeenCalledWith(
        'published version 99 missing for site dangling; serving current',
      );
    } finally {
      logged.mockRestore();
    }
  });
});
