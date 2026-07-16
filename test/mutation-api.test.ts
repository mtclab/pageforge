import { beforeEach, describe, expect, it } from 'vitest';
import type { SiteData } from '../src/engine/types.js';
import worker from '../src/worker/index.js';
import minimal from './fixtures/minimal.json';
import { jsonRequest, MemoryKV, workerEnv } from './worker-fixture.js';

const operatorKey = 'operator-secret';
const base = minimal as SiteData;

function site(name = 'Alkuperäinen'): SiteData {
  return {
    ...base,
    name,
    lang: 'fi',
    sections: [{ kind: 'hours', days: [{ label: 'Maanantai', open: '9', close: '17' }] }],
  };
}

describe('business mutation API', () => {
  let env: ReturnType<typeof workerEnv>;

  beforeEach(() => {
    env = workerEnv();
  });

  async function create(data = site()): Promise<{ id: string; approvalKey: string }> {
    const response = await worker.fetch(jsonRequest('/api/biz/sites', 'POST', { data }, operatorKey), env);
    expect(response.status).toBe(200);
    return response.json() as Promise<{ id: string; approvalKey: string }>;
  }

  async function propose(id: string, candidate: SiteData, note?: string): Promise<{
    proposalId: string;
    previewPath: string;
    summary: string[];
  }> {
    const response = await worker.fetch(
      jsonRequest(`/api/biz/sites/${id}/proposals`, 'POST', { candidate, note }, operatorKey),
      env,
    );
    expect(response.status).toBe(200);
    return response.json() as Promise<{ proposalId: string; previewPath: string; summary: string[] }>;
  }

  it('creates, previews, approves, and serves the current site with version metadata', async () => {
    const { id, approvalKey } = await create();
    expect(id).toMatch(/^[a-z0-9]{8}$/);
    expect(approvalKey.length).toBeGreaterThan(20);

    const candidate: SiteData = {
      ...site('Päivitetty nimi'),
      tagline: 'Uusi kuvaus',
      sections: [
        ...site().sections,
        { kind: 'services', items: [{ name: 'Leikkaus', price: '35 €' }] },
      ],
    };
    const proposal = await propose(id, candidate, 'Customer-approved wording');
    expect(proposal.previewPath).toBe(`/p/${id}/${proposal.proposalId}`);
    expect(proposal.summary).toContain('name changed');
    expect(proposal.summary).toContain('tagline changed');
    expect(proposal.summary).toContain('sections/services added');

    const before = await worker.fetch(jsonRequest(`/api/biz/sites/${id}`, 'GET', undefined, approvalKey), env);
    const beforeBody = await before.json() as { openProposals: string[]; versions: unknown[] };
    expect(beforeBody.openProposals).toEqual([proposal.proposalId]);
    expect(beforeBody.versions).toEqual([]);

    const preview = await worker.fetch(new Request(`https://example.test${proposal.previewPath}`), env);
    const previewHtml = await preview.text();
    expect(preview.status).toBe(200);
    expect(preview.headers.get('x-robots-tag')).toBe('noindex');
    expect(previewHtml).toContain('<meta name="robots" content="noindex">');
    expect(previewHtml).toContain('Luonnos - esikatselu');
    expect(previewHtml).toContain('Päivitetty nimi');
    expect(previewHtml).toContain('<style>');

    const approved = await worker.fetch(
      jsonRequest(`/api/biz/sites/${id}/proposals/${proposal.proposalId}/approve`, 'POST', {}, approvalKey),
      env,
    );
    expect(approved.status).toBe(200);
    expect(await approved.json()).toEqual({ ok: true, version: 1 });

    const published = await worker.fetch(new Request(`https://example.test/b/${id}`), env);
    const publishedHtml = await published.text();
    expect(published.status).toBe(200);
    expect(published.headers.get('x-robots-tag')).toBe('noindex');
    expect(publishedHtml).toContain('Päivitetty nimi');
    expect(publishedHtml).not.toContain('Luonnos - esikatselu');

    const after = await worker.fetch(jsonRequest(`/api/biz/sites/${id}`, 'GET', undefined, operatorKey), env);
    const afterBody = await after.json() as {
      data: SiteData;
      versions: { n: number; at: number; note?: string; data?: SiteData }[];
      openProposals: string[];
    };
    expect(afterBody.data.name).toBe('Päivitetty nimi');
    expect(afterBody.versions).toHaveLength(1);
    expect(afterBody.versions[0]).toMatchObject({ n: 1, note: 'Customer-approved wording' });
    expect(afterBody.versions[0]).not.toHaveProperty('data');
    expect(afterBody.openProposals).toEqual([]);
    expect((await worker.fetch(new Request(`https://example.test${proposal.previewPath}`), env)).status).toBe(404);
  });

  it('rejects a proposal without changing the current site', async () => {
    const { id, approvalKey } = await create();
    const proposal = await propose(id, site('Ei julkaista'));
    const rejected = await worker.fetch(
      jsonRequest(`/api/biz/sites/${id}/proposals/${proposal.proposalId}/reject`, 'POST', {}, approvalKey),
      env,
    );
    expect(rejected.status).toBe(200);
    expect(await rejected.json()).toEqual({ ok: true });
    const page = await worker.fetch(new Request(`https://example.test/b/${id}`), env);
    expect(await page.text()).toContain('Alkuperäinen');
    expect((await worker.fetch(new Request(`https://example.test${proposal.previewPath}`), env)).status).toBe(404);
  });

  it('rolls back to a previous published snapshot and snapshots the replaced state', async () => {
    const { id, approvalKey } = await create();
    const proposal = await propose(id, site('Toinen'));
    await worker.fetch(
      jsonRequest(`/api/biz/sites/${id}/proposals/${proposal.proposalId}/approve`, 'POST', {}, approvalKey),
      env,
    );

    const rollback = await worker.fetch(
      jsonRequest(`/api/biz/sites/${id}/rollback`, 'POST', { to: 1 }, approvalKey),
      env,
    );
    expect(rollback.status).toBe(200);
    expect(await rollback.json()).toEqual({ ok: true, version: 2 });
    const page = await worker.fetch(new Request(`https://example.test/b/${id}`), env);
    expect(await page.text()).toContain('Alkuperäinen');

    const detail = await worker.fetch(jsonRequest(`/api/biz/sites/${id}`, 'GET', undefined, approvalKey), env);
    const body = await detail.json() as { versions: { n: number }[] };
    expect(body.versions.map(({ n }) => n)).toEqual([2, 1]);
  });

  it('returns 401 for missing credentials and 403 for wrong credentials', async () => {
    expect((await worker.fetch(jsonRequest('/api/biz/sites', 'POST', { data: site() }), env)).status).toBe(401);
    expect((await worker.fetch(jsonRequest('/api/biz/sites', 'POST', { data: site() }, 'wrong'), env)).status).toBe(403);
    const { id } = await create();
    expect((await worker.fetch(jsonRequest(`/api/biz/sites/${id}`, 'GET'), env)).status).toBe(401);
    expect((await worker.fetch(jsonRequest(`/api/biz/sites/${id}`, 'GET', undefined, 'wrong'), env)).status).toBe(403);
  });

  it('keeps all business surfaces closed unless both the flag and operator key are set', async () => {
    for (const closedEnv of [
      workerEnv({ MUTATION_API_ENABLED: 'false' }),
      workerEnv({ MUTATION_API_ENABLED: 'true', OPERATOR_KEY: undefined }),
    ]) {
      expect((await worker.fetch(jsonRequest('/api/biz/sites', 'POST', { data: site() }, operatorKey), closedEnv)).status).toBe(404);
      expect((await worker.fetch(new Request('https://example.test/p/12345678/abcdefgh'), closedEnv)).status).toBe(404);
      expect((await worker.fetch(new Request('https://example.test/b/12345678'), closedEnv)).status).toBe(404);
    }
  });

  it('rejects an invalid proposal candidate', async () => {
    const { id } = await create();
    const invalid = { ...site(), name: '' };
    const response = await worker.fetch(
      jsonRequest(`/api/biz/sites/${id}/proposals`, 'POST', { candidate: invalid }, operatorKey),
      env,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'name is required' });
  });

  it('caps proposals at 50 per site per day', async () => {
    const { id } = await create();
    const day = new Date().toISOString().slice(0, 10);
    (env.SITES as MemoryKV).values.set(`bizrl:${id}:${day}`, '50');
    const response = await worker.fetch(
      jsonRequest(`/api/biz/sites/${id}/proposals`, 'POST', { candidate: site('Liikaa') }, operatorKey),
      env,
    );
    expect(response.status).toBe(429);
  });
});
