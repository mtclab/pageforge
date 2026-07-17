import { beforeEach, describe, expect, it } from 'vitest';
import type { SiteData } from '../src/engine/types.js';
import type { BusinessProfile } from '../src/worker/business-profile.js';
import { ControlPlane } from '../src/worker/db.js';
import worker from '../src/worker/index.js';
import { sha256Hex } from '../src/worker/shared.js';
import minimal from './fixtures/minimal.json';
import { jsonRequest, workerEnv } from './worker-fixture.js';

const base = minimal as SiteData;

function emailMessage(from: string, to: string, body: string, subject = 'Muutos'): {
  from: string;
  to: string;
  raw: ReadableStream<Uint8Array>;
  headers: Headers;
} {
  return {
    from,
    to,
    raw: new Response(body).body!,
    headers: new Headers({ subject }),
  };
}

describe('S7 update channels', () => {
  let env: ReturnType<typeof workerEnv>;
  let cp: ControlPlane;

  beforeEach(() => {
    env = workerEnv();
    cp = new ControlPlane(env.DB);
  });

  async function seedSite(publicId = 'site0001', data: SiteData = base, prospectId?: number): Promise<void> {
    await cp.createSite({
      publicId,
      approvalKeyHash: 'hash',
      data: { ...data, name: data.name || publicId },
      actor: 'operator',
      ...(prospectId === undefined ? {} : { prospectId }),
    });
  }

  it('creates, lists, links, and closes queue rows with audit events', async () => {
    await seedSite();
    const site = (await cp.getSiteByPublicId('site0001'))!;
    const created = await cp.createUpdateRequest({
      site,
      channel: 'email',
      fromAddr: 'customer@example.fi',
      subject: '<muutos>',
      body: '<script>alert(1)</script>',
    });
    expect(await cp.listUpdateRequests('uusi')).toEqual([created]);
    expect(await cp.getUpdateRequest(created.id)).toEqual(created);
    expect(await cp.linkUpdateRequestProposal(created.id, 'proposal', 'mcp')).toBe(true);
    expect(await cp.getUpdateRequest(created.id)).toMatchObject({
      status: 'ehdotettu',
      proposalPublicId: 'proposal',
    });
    expect(await cp.closeUpdateRequest(created.id)).toBe(true);
    expect(await cp.closeUpdateRequest(created.id)).toBe(false);
    expect((await cp.getUpdateRequest(created.id))?.status).toBe('suljettu');
    expect(await cp.listUpdateRequests()).toEqual([]);
    expect(await cp.listUpdateRequests('suljettu')).toEqual([
      expect.objectContaining({ id: created.id, status: 'suljettu' }),
    ]);
    const events = await cp.listAuditEvents({ entity: 'update_request', entityId: String(created.id), limit: 10 });
    expect(events.map((event) => event.action)).toEqual([
      'update_request.close',
      'update_request.link',
      'update_request.create',
    ]);
  });

  it('matches email by plus address and contact email, caps raw input, and audits drops', async () => {
    await cp.createProspect({ publicId: 'pros0001', name: 'Yritys', status: 'myyty', actor: 'operator' });
    const prospect = (await cp.getProspect('pros0001'))!;
    const profile: BusinessProfile = {
      identity: { name: 'Yritys' },
      contact: { email: 'owner@example.fi' },
      hours: [], services: [], menu: [], photos: [], links: [], provenance: {}, consent: {},
    };
    await cp.upsertBusinessProfile({ publicId: 'prof0001', prospectId: prospect.id, data: profile, actor: 'operator' });
    await seedSite('site0001', base, prospect.id);

    await worker.email(emailMessage('anyone@example.fi', 'paivita+site0001@example.test', 'a'.repeat(70_000)), env);
    await worker.email(emailMessage('OWNER@example.fi', 'updates@example.test', 'contact body'), env);
    await worker.email(emailMessage('unknown@example.fi', 'updates@example.test', 'drop me'), env);

    const requests = await cp.listUpdateRequests();
    expect(requests).toHaveLength(2);
    expect(new TextEncoder().encode(requests[1]!.body)).toHaveLength(64 * 1024);
    expect(requests[0]).toMatchObject({ fromAddr: 'owner@example.fi', body: 'contact body' });
    expect((await cp.listAuditEvents({ limit: 20 })).some((event) => event.action === 'email.unmatched')).toBe(true);

    expect((await worker.fetch(jsonRequest('/api/biz/email-ingress', 'POST', {
      from: 'owner@example.fi', to: 'updates@example.test', subject: 'Sim', text: 'simulated',
    }), env)).status).toBe(401);
    const simulated = await worker.fetch(jsonRequest('/api/biz/email-ingress', 'POST', {
      from: 'owner@example.fi', to: 'updates@example.test', subject: 'Sim', text: 'simulated',
    }, 'operator-secret'), env);
    expect(simulated.status).toBe(200);
    expect(await simulated.json()).toMatchObject({ ok: true, matched: true });
  });

  it('scopes the customer form and creates a linked proposal without accepting forged fields', async () => {
    const data: SiteData = {
      ...base,
      name: 'Turvallinen nimi',
      capabilities: { hours: true, notice: true, services: false },
      sections: [
        { kind: 'hours', days: [{ label: 'Ma', open: '09:00', close: '17:00' }] },
        { kind: 'notice', title: 'Vanha', text: 'Vanha tiedote' },
      ],
    };
    await seedSite('panel001', data);
    const site = (await cp.getSiteByPublicId('panel001'))!;
    const token = '11111111111111111111111111111111';
    const tokenId = await cp.createPanelToken({ tokenHash: await sha256Hex(token), site });

    expect((await worker.fetch(new Request('https://example.test/panel'), env)).status).toBe(404);
    const panel = await worker.fetch(new Request(`https://example.test/panel?t=${token}`), env);
    const panelHtml = await panel.text();
    expect(panelHtml).toContain('Aukioloajat');
    expect(panelHtml).toContain('Tiedote');
    expect(panelHtml).not.toContain('<h2>Palvelut</h2>');
    expect(panelHtml.match(/<script src="\/rows\.js"><\/script>/g)).toHaveLength(1);

    const addRows = await worker.fetch(new Request(`https://example.test/panel?t=${token}`, {
      method: 'POST',
      body: new URLSearchParams({
        t: token,
        hours_0_label: 'Yö',
        hours_0_open: '22:00',
        hours_0_close: '02:00',
        hours_1_label: '',
        hours_2_label: '',
        add_rows: 'hours',
      }),
    }), env);
    expect(addRows.status).toBe(200);
    const addRowsHtml = await addRows.text();
    expect(addRowsHtml).toContain('name="hours_0_label" value="Yö"');
    expect(addRowsHtml).toContain('name="hours_5_label" value=""');
    expect(await cp.listUpdateRequests()).toHaveLength(0);

    const posted = await worker.fetch(new Request(`https://example.test/panel?t=${token}`, {
      method: 'POST',
      body: new URLSearchParams({
        t: token,
        name: 'Väärennetty nimi',
        themeId: 'forged',
        hours_0_label: 'Ti',
        hours_0_open: '10:00',
        hours_0_close: '18:00',
        notice_title: '<otsikko>',
        notice_text: 'Uusi tiedote',
        notice_until: '2026-12-31',
        services_0_name: 'Ei sallittu',
      }),
    }), env);
    expect(posted.status).toBe(200);
    expect(await posted.text()).toContain('Kiitos! Ehdotus odottaa vahvistusta.');

    const request = (await cp.listUpdateRequests())[0]!;
    expect(request).toMatchObject({ channel: 'panel', status: 'ehdotettu' });
    const proposal = await cp.getProposal(site.id, request.proposalPublicId!);
    expect(proposal?.candidate.name).toBe('Turvallinen nimi');
    expect(proposal?.candidate.meta.themeId).toBe(base.meta.themeId);
    expect(proposal?.candidate.sections).not.toContainEqual(expect.objectContaining({ kind: 'services' }));
    expect(proposal?.candidate.sections).toContainEqual({
      kind: 'notice', title: '<otsikko>', text: 'Uusi tiedote', until: '2026-12-31',
    });

    expect(await cp.revokePanelToken({ id: tokenId, site })).toBe(true);
    expect((await worker.fetch(new Request(`https://example.test/panel?t=${token}`), env)).status).toBe(404);
    const expired = '22222222222222222222222222222222';
    await cp.createPanelToken({ tokenHash: await sha256Hex(expired), site, expiresAt: Date.now() - 1 });
    expect((await worker.fetch(new Request(`https://example.test/panel?t=${expired}`), env)).status).toBe(404);
  });

  it('gives panel submissions a separate 20/day budget from operator proposals', async () => {
    const data: SiteData = {
      ...base,
      name: 'Kanavakohtainen raja',
      capabilities: { notice: true },
      sections: [{ kind: 'notice', text: 'Alku' }],
    };
    await seedSite('rate0001', data);
    const site = (await cp.getSiteByPublicId('rate0001'))!;
    const token = '33333333333333333333333333333333';
    await cp.createPanelToken({ tokenHash: await sha256Hex(token), site });

    const panelPost = (): Promise<Response> => worker.fetch(new Request(
      `https://example.test/panel?t=${token}`,
      {
        method: 'POST',
        body: new URLSearchParams({ t: token, notice_text: 'Päivitetty' }),
      },
    ), env);
    for (let count = 0; count < 20; count++) {
      expect((await panelPost()).status).toBe(200);
    }
    expect((await panelPost()).status).toBe(429);

    const operator = await worker.fetch(
      jsonRequest('/api/biz/sites/rate0001/proposals', 'POST', {
        candidate: { ...data, tagline: 'Operaattorin ehdotus' },
      }, 'operator-secret'),
      env,
    );
    expect(operator.status).toBe(200);
  });

  it('uses the site section title, shows spare rows without an empty message, and renders descriptions', async () => {
    const data: SiteData = {
      ...base,
      capabilities: { services: true },
      sections: [{ kind: 'services', title: 'Ruokalista', items: [] }],
    };
    await seedSite('menupnl1', data);
    const site = (await cp.getSiteByPublicId('menupnl1'))!;
    const token = '44444444444444444444444444444444';
    await cp.createPanelToken({ tokenHash: await sha256Hex(token), site });

    const html = await (await worker.fetch(
      new Request(`https://example.test/panel?t=${token}`),
      env,
    )).text();
    expect(html).toContain('<h2>Ruokalista</h2>');
    expect(html).toContain('name="services_0_desc"');
    expect(html).not.toContain('Ei rivejä vielä - lisää ensimmäinen.');
    expect(html).toContain('Saat esikatselulinkin vahvistusta varten');
    expect(html).not.toMatch(/<select[^>]+name="[^"]+_source"/);
  });
});
