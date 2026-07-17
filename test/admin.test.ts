import { beforeEach, describe, expect, it } from 'vitest';
import type { SiteData } from '../src/engine/types.js';
import { PROSPECT_TRANSITIONS } from '../src/worker/admin.js';
import { ControlPlane, type ProspectStatus } from '../src/worker/db.js';
import worker from '../src/worker/index.js';
import { signSessionCookie } from '../src/worker/session.js';
import minimal from './fixtures/minimal.json';
import { workerEnv } from './worker-fixture.js';

const operatorKey = 'operator-secret';
const base = minimal as SiteData;

function site(name: string): SiteData {
  return { ...base, name, tagline: `${name} tagline`, lang: 'fi' };
}

function formRequest(path: string, fields: Record<string, string>, cookie?: string): Request {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  return new Request(`https://example.test${path}`, {
    method: 'POST',
    headers,
    body: new URLSearchParams(fields),
  });
}

function cookieValue(response: Response): string {
  return response.headers.get('set-cookie')!.split(';')[0]!;
}

describe('operator console', () => {
  let env: ReturnType<typeof workerEnv>;
  let cp: ControlPlane;
  let cookie: string;
  let csrf: string;

  beforeEach(async () => {
    env = workerEnv();
    cp = new ControlPlane(env.DB);
    const login = await worker.fetch(formRequest('/admin/login', { key: operatorKey }), env);
    cookie = cookieValue(login);
    const dashboard = await worker.fetch(new Request('https://example.test/admin', {
      headers: { cookie },
    }), env);
    const dashboardHtml = await dashboard.text();
    csrf = dashboardHtml.match(/name="csrf" value="([a-f0-9]{64})"/)![1]!;
  });

  async function get(path: string, sentCookie = cookie): Promise<Response> {
    return worker.fetch(new Request(`https://example.test${path}`, {
      headers: sentCookie ? { cookie: sentCookie } : undefined,
    }), env);
  }

  async function post(path: string, fields: Record<string, string> = {}): Promise<Response> {
    return worker.fetch(formRequest(path, { csrf, ...fields }, cookie), env);
  }

  async function seedSite(id = 'site0001'): Promise<void> {
    await cp.createSite({
      publicId: id,
      approvalKeyHash: 'hash',
      data: site('Alkuperäinen'),
      actor: 'operator',
    });
  }

  it('handles login, redirects invalid sessions, and applies admin headers', async () => {
    const wrong = await worker.fetch(formRequest('/admin/login', { key: 'wrong' }), env);
    expect(wrong.status).toBe(403);
    expect(await wrong.text()).toContain('Väärä operaattoriavain');

    const right = await worker.fetch(formRequest('/admin/login', { key: operatorKey }), env);
    expect(right.status).toBe(303);
    expect(right.headers.get('location')).toBe('/admin');
    const setCookie = right.headers.get('set-cookie')!;
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Strict');
    expect(setCookie).toContain('Path=/admin');

    const missing = await get('/admin', '');
    expect(missing.status).toBe(303);
    expect(missing.headers.get('location')).toBe('/admin/login');

    const expired = await signSessionCookie(operatorKey, Date.now() - 13 * 60 * 60 * 1000);
    expect((await get('/admin', `pf_admin=${expired.value}`)).status).toBe(303);
    const value = cookie.split('=')[1]!;
    const tampered = `${value.slice(0, -1)}${value.endsWith('0') ? '1' : '0'}`;
    expect((await get('/admin', `pf_admin=${tampered}`)).status).toBe(303);

    const dashboard = await get('/admin');
    expect(dashboard.headers.get('cache-control')).toBe('no-store');
    expect(dashboard.headers.get('x-robots-tag')).toBe('noindex');
  });

  it('requires a valid CSRF token for mutating forms', async () => {
    const missing = await worker.fetch(formRequest('/admin/prospects', { name: 'Missing' }, cookie), env);
    expect(missing.status).toBe(403);
    const bad = await worker.fetch(formRequest('/admin/prospects', { name: 'Bad', csrf: 'bad' }, cookie), env);
    expect(bad.status).toBe(403);
    expect(await cp.listProspects()).toHaveLength(0);
  });

  it('creates an escaped prospect and enforces every legal transition', async () => {
    const created = await post('/admin/prospects', {
      name: '<img src=x onerror=alert(1)>',
      municipality: 'Turku',
    });
    expect(created.status).toBe(303);
    const createdId = created.headers.get('location')!.split('/').pop()!;
    const detail = await get(`/admin/prospects/${createdId}`);
    const detailHtml = await detail.text();
    expect(detailHtml).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(detailHtml).not.toContain('<img src=x');

    let sequence = 0;
    for (const [current, targets] of Object.entries(PROSPECT_TRANSITIONS) as [ProspectStatus, readonly ProspectStatus[]][]) {
      for (const target of targets) {
        const publicId = `tr${String(sequence++).padStart(6, '0')}`;
        await cp.createProspect({ publicId, name: `${current}-${target}`, status: current, actor: 'operator' });
        const response = await post(`/admin/prospects/${publicId}/status`, {
          status: target,
          ...(target === 'hylatty' ? { statusReason: 'Ei sovi' } : {}),
        });
        expect(response.status, `${current} -> ${target}`).toBe(303);
        expect((await cp.getProspect(publicId))?.status).toBe(target);
      }
    }

    await cp.createProspect({ publicId: 'illegal1', name: 'Illegal', status: 'loytynyt', actor: 'operator' });
    expect((await post('/admin/prospects/illegal1/status', { status: 'myyty' })).status).toBe(400);
    expect((await cp.getProspect('illegal1'))?.status).toBe('loytynyt');
    expect((await post('/admin/prospects/illegal1/status', { status: 'hylatty' })).status).toBe(400);
    expect((await cp.getProspect('illegal1'))?.statusReason).toBeUndefined();
  });

  it('approves and rolls back through shared business operations with operator audit rows', async () => {
    await seedSite();
    const current = (await cp.getSiteByPublicId('site0001'))!;
    await cp.createProposal({
      site: current,
      publicId: 'proposal',
      candidate: site('Päivitetty'),
      summary: ['name changed'],
      actor: 'mcp',
    });

    const detail = await get('/admin/sites/site0001');
    const detailHtml = await detail.text();
    expect(detailHtml).toContain('/p/site0001/proposal');
    expect(detailHtml).toContain('proposal.create');
    expect((await post('/admin/sites/site0001/proposals/proposal/approve')).status).toBe(303);
    expect((await cp.getSiteByPublicId('site0001'))?.data.name).toBe('Päivitetty');
    expect((await cp.getSiteByPublicId('site0001'))?.currentVersion).toBe(1);
    const approveAudit = await cp.listAuditEvents({ entity: 'site', entityId: 'site0001', limit: 20 });
    expect(approveAudit).toEqual(expect.arrayContaining([
      expect.objectContaining({ actor: 'operator', action: 'proposal.approve' }),
    ]));

    expect((await post('/admin/sites/site0001/rollback', { to: '1' })).status).toBe(303);
    expect((await cp.getSiteByPublicId('site0001'))?.data.name).toBe('Alkuperäinen');
    expect((await cp.getSiteByPublicId('site0001'))?.currentVersion).toBe(2);
    const rollbackAudit = await cp.listAuditEvents({ entity: 'site', entityId: 'site0001', limit: 20 });
    expect(rollbackAudit).toEqual(expect.arrayContaining([
      expect.objectContaining({ actor: 'operator', action: 'site.rollback' }),
    ]));
  });

  it('paginates and filters the audit log and reports dashboard counts', async () => {
    await cp.createProspect({ publicId: 'count001', name: 'Count me', status: 'arvioitu', actor: 'operator' });
    await seedSite('countsite');
    const seeded = (await cp.getSiteByPublicId('countsite'))!;
    await cp.createProposal({
      site: seeded,
      publicId: 'countprp',
      candidate: site('Candidate'),
      summary: [],
      actor: 'mcp',
    });
    for (let index = 0; index < 55; index++) {
      await cp.recordAudit({
        actor: 'system',
        action: `page.${index}`,
        entity: index === 54 ? 'special' : 'page',
        entityId: String(index),
      });
    }

    const firstPage = await get('/admin/audit');
    const firstHtml = await firstPage.text();
    expect((firstHtml.match(/<tbody><tr>|<tr>/g) ?? []).length).toBeGreaterThanOrEqual(50);
    expect(firstHtml).toContain('Vanhemmat tapahtumat');
    const before = firstHtml.match(/before%3D(\d+)/)?.[1] ?? firstHtml.match(/before=(\d+)/)?.[1];
    expect(before).toBeDefined();
    const secondPage = await get(`/admin/audit?before=${before}`);
    expect(await secondPage.text()).toContain('page.');

    const filtered = await get('/admin/audit?entity=special&entityId=54');
    const filteredHtml = await filtered.text();
    expect(filteredHtml).toContain('page.54');
    expect(filteredHtml).not.toContain('page.53');

    const dashboard = await get('/admin');
    const dashboardHtml = await dashboard.text();
    expect(dashboardHtml).toContain('<span class="badge">arvioitu</span></div><div class="number">1</div>');
    expect(dashboardHtml).toContain('<span class="badge">draft</span></div><div class="number">1</div>');
    expect(dashboardHtml).toContain('<div>Avoimet ehdotukset</div><div class="number">1</div>');
  });

  it('saves an intake, composes one site plus two proposals, and previews all variants', async () => {
    await cp.createProspect({
      publicId: 'intake01',
      name: 'Grilli Testi',
      status: 'arvioitu',
      vertical: 'grilli',
      actor: 'operator',
    });
    const intake = await get('/admin/prospects/intake01/intake');
    expect(intake.status).toBe(200);
    expect(await intake.text()).toContain('BusinessProfile intake');

    const saved = await post('/admin/prospects/intake01/intake', {
      name: 'Grilli Testi',
      yTunnus: '1572860-0',
      vertical_code: 'grilli',
      vertical_label: 'Grilli',
      identity_source: 'prh',
      phone: '+358 40 123 4567',
      email: 'hei@example.com',
      street: 'Testikatu 1',
      postal: '00100',
      city: 'Helsinki',
      contact_source: 'owner',
      hours_0_label: 'Maanantai',
      hours_0_open: '09:00',
      hours_0_close: '17:00',
      hours_0_source: 'owner',
      menu_0_name: 'Burgeri',
      menu_0_price: '12,50 €',
      menu_0_desc: 'Naudanlihapihvi',
      menu_0_source: 'owner',
      tagline: 'Tervetuloa grillille',
      tagline_source: 'owner',
      about: 'Paikallinen grilli.',
      about_source: 'owner',
      links_0_label: 'Kotisivu',
      links_0_url: 'https://example.com',
      links_0_kind: 'website',
      links_0_source: 'operator',
      consent_texts: 'on',
      consent_note: 'Omistaja vahvisti tekstit.',
    });
    expect(saved.status).toBe(303);
    const prospect = (await cp.getProspect('intake01'))!;
    const profile = (await cp.getBusinessProfileByProspectId(prospect.id))!;
    expect(profile.data.menu[0]?.name).toBe('Burgeri');
    expect(profile.data.provenance['identity.name']?.source).toBe('prh');
    expect(profile.consentNote).toBe('Omistaja vahvisti tekstit.');

    const updated = await post('/admin/prospects/intake01/intake', {
      name: 'Grilli Testi',
      vertical_code: 'grilli',
      vertical_label: 'Grilli',
    });
    expect(updated.status).toBe(303);
    const audit = await cp.listAuditEvents({ entity: 'profile', entityId: profile.publicId, limit: 10 });
    expect(audit.map((event) => event.action)).toEqual(['profile.update', 'profile.create']);

    const detailHtml = await (await get('/admin/prospects/intake01')).text();
    expect(detailHtml).toContain('/admin/prospects/intake01/compose');
    const composed = await post('/admin/prospects/intake01/compose');
    expect(composed.status).toBe(303);
    const siteId = composed.headers.get('location')!.split('/').pop()!;
    const siteRecord = (await cp.getSiteByProspectId(prospect.id))!;
    expect(siteRecord.publicId).toBe(siteId);
    expect(siteRecord.status).toBe('draft');
    const proposals = await cp.listOpenProposals(siteRecord.id);
    expect(proposals).toHaveLength(2);
    expect((await get(`/p/${siteId}/current`)).status).toBe(200);
    for (const proposal of proposals) {
      expect((await get(`/p/${siteId}/${proposal.proposalId}`)).status).toBe(200);
    }
    expect((await post('/admin/prospects/intake01/compose')).status).toBe(400);
  });

  it('returns 404 when the mutation gate is closed', async () => {
    const closed = workerEnv({ MUTATION_API_ENABLED: 'false' });
    const response = await worker.fetch(new Request('https://example.test/admin'), closed);
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
  });
});
