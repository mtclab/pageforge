import { beforeEach, describe, expect, it } from 'vitest';
import type { SiteData } from '../src/engine/types.js';
import { ControlPlane } from '../src/worker/db.js';
import worker from '../src/worker/index.js';
import { sha256Hex } from '../src/worker/shared.js';
import minimal from './fixtures/minimal.json';
import { MemoryR2 } from './d1-fixture.js';
import { MemoryKV, jsonRequest, workerEnv } from './worker-fixture.js';

const operatorKey = 'operator-secret';
const approvalKey = 'approval-secret';
const decoder = new TextDecoder();

function siteData(name: string): SiteData {
  return { ...(minimal as SiteData), name, lang: 'fi' };
}

function readStoreZip(bytes: Uint8Array): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    expect(view.getUint16(offset + 8, true)).toBe(0);
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength));
    files[name] = bytes.slice(dataStart, dataStart + size);
    offset = dataStart + size;
  }
  expect(view.getUint32(offset, true)).toBe(0x02014b50);
  return files;
}

function formRequest(path: string, fields: Record<string, string>, cookie?: string): Request {
  return new Request(`https://example.test${path}`, {
    method: 'POST',
    headers: cookie ? { cookie } : undefined,
    body: new URLSearchParams(fields),
  });
}

async function operatorSession(env: ReturnType<typeof workerEnv>): Promise<{ cookie: string; csrf: string }> {
  const login = await worker.fetch(formRequest('/admin/login', { key: operatorKey }), env);
  const cookie = login.headers.get('set-cookie')!.split(';')[0]!;
  const dashboard = await worker.fetch(new Request('https://example.test/admin', {
    headers: { cookie },
  }), env);
  const csrf = (await dashboard.text()).match(/name="csrf" value="([a-f0-9]{64})"/)![1]!;
  return { cookie, csrf };
}

describe('S10 export and offboarding', () => {
  let env: ReturnType<typeof workerEnv>;
  let cp: ControlPlane;

  beforeEach(() => {
    env = workerEnv();
    cp = new ControlPlane(env.DB);
  });

  async function createSite(publicId: string, data = siteData(publicId), prospectId?: number) {
    await cp.createSite({
      publicId,
      approvalKeyHash: await sha256Hex(approvalKey),
      data,
      actor: 'operator',
      ...(prospectId === undefined ? {} : { prospectId }),
    });
    return (await cp.getSiteByPublicId(publicId))!;
  }

  it('exports a deterministic STORE ZIP with published data and materialized photos', async () => {
    const sha = 'a'.repeat(64);
    const published: SiteData = {
      ...siteData('Julkaistu versio'),
      photo: { src: `/img/${sha}` },
      sections: [{
        kind: 'gallery',
        title: 'Kuvat',
        photos: [{ dataUrl: 'data:image/jpeg;base64,AQID' }],
      }],
    };
    const original = await createSite('export01', published);
    const r2Bytes = new Uint8Array([7, 8, 9, 10]);
    await env.PHOTOS.put(`photos/${sha}`, r2Bytes, { httpMetadata: { contentType: 'image/png' } });
    await cp.putPhotoMeta({
      r2Key: `photos/${sha}`,
      siteId: original.id,
      contentType: 'image/png',
      bytes: r2Bytes.byteLength,
      actor: 'operator',
    });
    await cp.createProposal({
      site: original,
      publicId: 'newdraft',
      candidate: siteData('Nykyinen luonnos'),
      summary: ['name changed'],
      actor: 'operator',
    });
    await cp.approveProposal(original, (await cp.getProposal(original.id, 'newdraft'))!, {
      actor: 'operator', action: 'proposal.approve', entity: 'site', entityId: original.publicId,
    });
    const current = (await cp.getSiteByPublicId(original.publicId))!;
    await cp.publishSiteVersion(current, 1, 'operator');

    const wrong = await worker.fetch(
      jsonRequest('/api/biz/sites/export01/export', 'GET', undefined, 'wrong'),
      env,
    );
    expect(wrong.status).toBe(403);

    const operator = await worker.fetch(
      jsonRequest('/api/biz/sites/export01/export', 'GET', undefined, operatorKey),
      env,
    );
    expect(operator.status).toBe(200);
    expect(operator.headers.get('content-type')).toBe('application/zip');
    const firstZip = new Uint8Array(await operator.arrayBuffer());
    const files = readStoreZip(firstZip);
    expect(Object.keys(files).sort()).toEqual([
      'LUEMINUT.txt',
      `assets/${sha}.png`,
      'assets/favicon.svg',
      'assets/gallery-1-1.jpg',
      'index.html',
      'site.json',
    ]);
    expect([...files[`assets/${sha}.png`]!]).toEqual([...r2Bytes]);
    expect([...files['assets/gallery-1-1.jpg']!]).toEqual([1, 2, 3]);
    const html = decoder.decode(files['index.html']);
    expect(html).toContain('Julkaistu versio');
    expect(html).not.toContain('Nykyinen luonnos');
    expect(html).toContain(`src="assets/${sha}.png"`);
    expect(html).not.toContain('mikoshi-credit');
    expect(html).not.toContain('Sivut: Mikoshi');
    expect(html).not.toContain('Luonnos - esikatselu');
    expect(JSON.parse(decoder.decode(files['site.json']!))).toEqual(expect.objectContaining({
      name: 'Julkaistu versio',
      photo: { src: `assets/${sha}.png` },
    }));
    expect(decoder.decode(files['LUEMINUT.txt'])).toContain('millä tahansa');

    const approval = await worker.fetch(
      jsonRequest('/api/biz/sites/export01/export', 'GET', undefined, approvalKey),
      env,
    );
    expect(approval.status).toBe(200);
    expect(new Uint8Array(await approval.arrayBuffer())).toEqual(firstZip);
    expect(await cp.listAuditEvents({ entity: 'site', entityId: 'export01', limit: 20 }))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ action: 'site.export', actor: 'operator' }),
        expect.objectContaining({ action: 'site.export', actor: 'approval-key' }),
      ]));
  });

  it('archives, revokes capabilities, purges cache, logs actions, and restores', async () => {
    const site = await createSite('archive1');
    await cp.createProposal({
      site,
      publicId: 'openprop',
      candidate: siteData('Ehdotus'),
      summary: [],
      actor: 'operator',
    });
    const previewToken = '1'.repeat(32);
    await cp.createPreviewToken({
      tokenHash: await sha256Hex(previewToken),
      site,
      label: 'archive test',
      expiresAt: Date.now() + 60_000,
      actor: 'operator',
    });
    const panelToken = '2'.repeat(32);
    await cp.createPanelToken({
      tokenHash: await sha256Hex(panelToken),
      site,
      expiresAt: Date.now() + 60_000,
    });
    expect((await worker.fetch(new Request('https://example.test/b/archive1'), env)).status).toBe(200);
    expect([...((env.SITES as MemoryKV).values.keys())].some((key) => key.startsWith('bizhtml:archive1:'))).toBe(true);

    const { cookie, csrf } = await operatorSession(env);
    const archived = await worker.fetch(formRequest(
      '/admin/sites/archive1/archive',
      { csrf, confirm: 'true' },
      cookie,
    ), env);
    expect(archived.status).toBe(303);
    expect((await cp.getSiteByPublicId('archive1'))?.status).toBe('archived');
    expect((await worker.fetch(new Request('https://example.test/b/archive1'), env)).status).toBe(404);
    expect((await worker.fetch(new Request(`https://example.test/p/archive1/current?t=${previewToken}`), env)).status).toBe(404);
    expect((await worker.fetch(new Request(`https://example.test/panel?t=${panelToken}`), env)).status).toBe(404);
    expect([...((env.SITES as MemoryKV).values.keys())].some((key) => key.startsWith('bizhtml:archive1:'))).toBe(false);
    expect((await cp.getProposal(site.id, 'openprop'))?.status).toBe('superseded');
    expect((await cp.listDeletionLog({ limit: 20 })).map((entry) => entry.item))
      .toEqual(expect.arrayContaining([
        'cache_purged', 'tokens_revoked', 'proposals_superseded', 'site_archived',
      ]));

    const restored = await worker.fetch(formRequest(
      '/admin/sites/archive1/restore',
      { csrf },
      cookie,
    ), env);
    expect(restored.status).toBe(303);
    expect((await cp.getSiteByPublicId('archive1'))?.status).toBe('approved');
    expect((await worker.fetch(new Request('https://example.test/b/archive1'), env)).status).toBe(200);
    expect((await cp.listDeletionLog({ limit: 20 }))[0]).toEqual(
      expect.objectContaining({ item: 'site_restored', actor: 'operator' }),
    );
  });

  it('requires exact confirmation, permanently deletes site data, and retains orders and logs', async () => {
    await cp.createProspect({ publicId: 'prospect', name: 'Poistettava', status: 'arvioitu', actor: 'operator' });
    const prospect = (await cp.getProspect('prospect'))!;
    const site = await createSite('delete01', siteData('Poistettava'), prospect.id);
    const now = Date.now();
    await env.DB.prepare(
      'INSERT INTO business_profiles (public_id, prospect_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    ).bind('profile1', prospect.id, '{}', now, now).run();
    await cp.createProposal({
      site, publicId: 'deletepr', candidate: siteData('Ehdotus'), summary: [], actor: 'operator',
    });
    await cp.createUpdateRequest({ site, channel: 'panel', body: 'Päivitys' });
    await cp.createDraftComment({ site, author: 'operator', body: 'Kommentti' });
    await cp.recordQaRun(site, 0, [{ id: 'ok', label: 'OK', passed: true }]);
    await cp.checkLaunchChecklist(site, 'content', 'operator');
    await cp.createPreviewToken({
      tokenHash: await sha256Hex('3'.repeat(32)), site, label: 'delete',
      expiresAt: now + 60_000, actor: 'operator',
    });
    await cp.createPanelToken({ tokenHash: await sha256Hex('4'.repeat(32)), site });
    const order = await cp.createOrder({
      publicId: 'keepord1', site, provider: 'mock', amountBuildCents: 100,
      amountMonthlyCents: 10, actor: 'operator',
    });
    await cp.createProvisioningRun({
      publicId: 'deleterun', site, orderId: order.id, domain: 'delete.example',
      steps: [{ id: 'domain_register', ord: 1 }],
    });
    const r2Key = `photos/${'b'.repeat(64)}`;
    await env.PHOTOS.put(r2Key, new Uint8Array([5, 6]), { httpMetadata: { contentType: 'image/jpeg' } });
    await cp.putPhotoMeta({ r2Key, siteId: site.id, contentType: 'image/jpeg', bytes: 2, actor: 'operator' });

    const { cookie, csrf } = await operatorSession(env);
    await worker.fetch(formRequest('/admin/sites/delete01/archive', { csrf, confirm: 'true' }, cookie), env);
    const wrong = await worker.fetch(formRequest(
      '/admin/sites/delete01/delete', { csrf, confirm: 'wrong' }, cookie,
    ), env);
    expect(wrong.status).toBe(400);
    expect(await cp.getSiteByPublicId('delete01')).not.toBeNull();
    expect((env.PHOTOS as MemoryR2).objects.has(r2Key)).toBe(true);

    const removed = await worker.fetch(formRequest(
      '/admin/sites/delete01/delete', { csrf, confirm: 'delete01' }, cookie,
    ), env);
    expect(removed.status).toBe(303);
    expect(removed.headers.get('location')).toBe('/admin/deletions');
    expect(await cp.getSiteByPublicId('delete01')).toBeNull();
    expect((env.PHOTOS as MemoryR2).objects.has(r2Key)).toBe(false);
    expect((await worker.fetch(new Request('https://example.test/b/delete01'), env)).status).toBe(404);
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM orders WHERE public_id = ?')
      .bind('keepord1').first<{ count: number }>()).toEqual({ count: 1 });
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM audit_events WHERE entity_id = ?')
      .bind('delete01').first<{ count: number }>()).toEqual(expect.objectContaining({ count: expect.any(Number) }));
    const logs = await cp.listDeletionLog({ limit: 50 });
    expect(logs).toEqual(expect.arrayContaining([
      expect.objectContaining({ item: 'photos_deleted', detail: { count: 1 } }),
      expect.objectContaining({ item: 'business_profile_deleted', detail: { count: 1 } }),
      expect.objectContaining({ item: 'orders_retained', detail: { count: 1 } }),
      expect.objectContaining({ item: 'site_deleted', detail: { count: 1 } }),
    ]));
    const deletionPage = await worker.fetch(new Request('https://example.test/admin/deletions', {
      headers: { cookie },
    }), env);
    expect(await deletionPage.text()).toContain('delete01');
  });

  it('renders the printable Finnish transfer checklist with the latest domain', async () => {
    const site = await createSite('transfer1', siteData('Siirrettävä'));
    await cp.createProvisioningRun({
      publicId: 'transfer', site, domain: 'yritys.example', steps: [{ id: 'domain_register', ord: 1 }],
    });
    const { cookie } = await operatorSession(env);
    const response = await worker.fetch(new Request(
      'https://example.test/admin/sites/transfer1/transfer',
      { headers: { cookie } },
    ), env);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain('Siirron tarkistuslista');
    expect(html).toContain('yritys.example');
    expect(html).toContain('valtuutuskoodi');
    expect(html).toContain('DNS-tietueet');
    expect(html).toContain('Postilaatikoiden siirto');
    expect(html).toContain('/api/biz/sites/transfer1/export');
    expect(html).toContain('Mitä lakkaa toimimasta');
    expect(html).toContain('@media print');
  });
});
