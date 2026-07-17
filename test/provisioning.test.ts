import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SiteData } from '../src/engine/types.js';
import { ControlPlane, type ProvisioningRun, type Site } from '../src/worker/db.js';
import worker from '../src/worker/index.js';
import {
  abortProvisioningRun,
  PROVISIONING_STEPS,
  startProvisioningRun,
  transitionProvisioningStep,
  validProvisioningDomain,
} from '../src/worker/provisioning.js';
import { LAUNCH_CHECKLIST_ITEMS } from '../src/worker/qa.js';
import { sha256Hex } from '../src/worker/shared.js';
import { signSessionCookie } from '../src/worker/session.js';
import bizFood from './fixtures/biz-food.json';
import { jsonRequest, workerEnv } from './worker-fixture.js';

function formRequest(path: string, fields: Record<string, string>, cookie: string): Request {
  return new Request(`https://example.test${path}`, {
    method: 'POST',
    headers: { cookie },
    body: new URLSearchParams(fields),
  });
}

describe('S9 provisioning state machine', () => {
  let env: ReturnType<typeof workerEnv>;
  let cp: ControlPlane;

  beforeEach(() => {
    env = workerEnv();
    cp = new ControlPlane(env.DB);
  });

  async function seed(publicId: string): Promise<Site> {
    await cp.createSite({
      publicId,
      approvalKeyHash: await sha256Hex('approval-secret'),
      data: bizFood as SiteData,
      actor: 'operator',
    });
    return (await cp.getSiteByPublicId(publicId))!;
  }

  async function start(site: Site, domain = 'yritys.fi'): Promise<ProvisioningRun> {
    const result = await startProvisioningRun(cp, env, site, domain);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    return result.value;
  }

  async function resolveFirstSix(run: ProvisioningRun, site: Site): Promise<void> {
    for (const step of PROVISIONING_STEPS.slice(0, 6)) {
      const result = await transitionProvisioningStep(cp, env, run, site, step.id, 'ohitettu');
      expect(result.ok).toBe(true);
    }
  }

  async function openGate(site: Site): Promise<void> {
    await cp.recordQaRun(site, site.currentVersion, [{ id: 'ok', label: 'OK', passed: true }]);
    for (const item of LAUNCH_CHECKLIST_ITEMS) {
      await cp.checkLaunchChecklist(site, item.id, 'operator');
    }
  }

  it('keeps the ordered step definition data-driven and manual adapters waiting', async () => {
    expect(PROVISIONING_STEPS.map(({ id, ord }) => [id, ord])).toEqual([
      ['domain_register', 1],
      ['dns_zone', 2],
      ['email_mailbox', 3],
      ['hostname_attach', 4],
      ['tls_cert', 5],
      ['http_check', 6],
      ['go_live', 7],
    ]);
    const site = await seed('manual01');
    const run = await start(site);
    expect((await cp.listProvisioningSteps(run.id)).map((step) => step.status)).toEqual(
      Array.from({ length: 7 }, () => 'odottaa'),
    );
  });

  it('enforces ordering in the single transition function, requires evidence, and permits skips', async () => {
    const site = await seed('rules001');
    const run = await start(site);
    await transitionProvisioningStep(cp, env, run, site, 'domain_register', 'ohitettu');
    await transitionProvisioningStep(cp, env, run, site, 'dns_zone', 'ohitettu');

    const outOfOrder = await transitionProvisioningStep(
      cp,
      env,
      run,
      site,
      'hostname_attach',
      'tehty',
      'Hostname lisätty',
    );
    expect(outOfOrder).toEqual(expect.objectContaining({ ok: false, status: 400 }));
    if (!outOfOrder.ok) expect(outOfOrder.error).toContain('email_mailbox');

    const missingEvidence = await transitionProvisioningStep(
      cp,
      env,
      run,
      site,
      'email_mailbox',
      'tehty',
      '   ',
    );
    expect(missingEvidence).toEqual(expect.objectContaining({ ok: false, status: 400 }));
    expect((await cp.listProvisioningSteps(run.id)).find((step) => step.step === 'email_mailbox')?.status)
      .toBe('odottaa');

    expect((await transitionProvisioningStep(
      cp,
      env,
      run,
      site,
      'email_mailbox',
      'ohitettu',
    )).ok).toBe(true);
  });

  it('uses operator evidence in manual HTTP mode and a real injected fetch when enabled', async () => {
    const manualSite = await seed('httpman1');
    const manualRun = await start(manualSite, 'manual.fi');
    for (const step of PROVISIONING_STEPS.slice(0, 5)) {
      await transitionProvisioningStep(cp, env, manualRun, manualSite, step.id, 'ohitettu');
    }
    const unusedFetch = vi.fn();
    const missing = await transitionProvisioningStep(
      cp,
      env,
      manualRun,
      manualSite,
      'http_check',
      'tehty',
      undefined,
      unusedFetch as unknown as typeof fetch,
    );
    expect(missing.ok).toBe(false);
    expect(unusedFetch).not.toHaveBeenCalled();
    expect((await transitionProvisioningStep(
      cp,
      env,
      manualRun,
      manualSite,
      'http_check',
      'tehty',
      'Selain avasi sivun onnistuneesti',
      unusedFetch as unknown as typeof fetch,
    )).ok).toBe(true);

    const realSite = await seed('httpreal');
    const realRun = await start(realSite, 'real.example');
    for (const step of PROVISIONING_STEPS.slice(0, 5)) {
      await transitionProvisioningStep(cp, env, realRun, realSite, step.id, 'ohitettu');
    }
    env.VERIFY_HTTP_ENABLED = 'true';
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));
    const checked = await transitionProvisioningStep(
      cp,
      env,
      realRun,
      realSite,
      'http_check',
      'tehty',
      undefined,
      fetcher as unknown as typeof fetch,
    );
    expect(checked.ok).toBe(true);
    expect(fetcher).toHaveBeenCalledWith(
      'https://real.example/',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect((await cp.listProvisioningSteps(realRun.id)).find((step) => step.step === 'http_check'))
      .toEqual(expect.objectContaining({ status: 'tehty', evidence: 'GET https://real.example/ -> 204' }));
  });

  it('records a failed real HTTP probe as a failed audited transition', async () => {
    const site = await seed('httpfail');
    const run = await start(site, 'fail.example');
    for (const step of PROVISIONING_STEPS.slice(0, 5)) {
      await transitionProvisioningStep(cp, env, run, site, step.id, 'ohitettu');
    }
    env.VERIFY_HTTP_ENABLED = 'true';
    const result = await transitionProvisioningStep(
      cp,
      env,
      run,
      site,
      'http_check',
      'tehty',
      undefined,
      vi.fn(async () => new Response('bad', { status: 503 })) as unknown as typeof fetch,
    );
    expect(result).toEqual(expect.objectContaining({ ok: false, status: 400 }));
    expect((await cp.listProvisioningSteps(run.id)).find((step) => step.step === 'http_check'))
      .toEqual(expect.objectContaining({ status: 'epaonnistui', evidence: expect.stringContaining('503') }));
    expect((await cp.listAuditEvents({ entity: 'provisioning', entityId: run.publicId, limit: 20 }))[0])
      .toEqual(expect.objectContaining({
        action: 'provisioning.step',
        detail: { run: run.publicId, step: 'http_check', status: 'epaonnistui' },
      }));
  });

  it('blocks go-live on the publish gate and on an unpaid attached order', async () => {
    const gateSite = await seed('gateblk1');
    const gateRun = await start(gateSite, 'gate.example');
    await resolveFirstSix(gateRun, gateSite);
    const gateBlocked = await transitionProvisioningStep(
      cp, env, gateRun, gateSite, 'go_live', 'tehty',
    );
    expect(gateBlocked).toEqual(expect.objectContaining({ ok: false, status: 409 }));
    if (!gateBlocked.ok) expect(gateBlocked.error).toContain('Julkaisun ehdot puuttuvat');
    await openGate(gateSite);
    expect((await transitionProvisioningStep(
      cp, env, gateRun, gateSite, 'go_live', 'tehty',
    )).ok).toBe(true);

    const orderSite = await seed('orderblk');
    const order = await cp.createOrder({
      publicId: 'unpaid01',
      site: orderSite,
      provider: 'mock',
      amountBuildCents: 24_900,
      amountMonthlyCents: 1_900,
      actor: 'operator',
    });
    const orderRun = await start(orderSite, 'order.example');
    expect(orderRun.orderId).toBe(order.id);
    await resolveFirstSix(orderRun, orderSite);
    await openGate(orderSite);
    expect(await transitionProvisioningStep(
      cp, env, orderRun, orderSite, 'go_live', 'tehty',
    )).toEqual(expect.objectContaining({ ok: false, status: 409 }));
  });

  it('publishes the current version, completes the run, and audits go-live when green', async () => {
    const site = await seed('golive01');
    const order = await cp.createOrder({
      publicId: 'paid0001',
      site,
      provider: 'mock',
      amountBuildCents: 24_900,
      amountMonthlyCents: 1_900,
      actor: 'operator',
    });
    await cp.transitionOrder(order, 'maksettu');
    const run = await start(site, 'live.example');
    await resolveFirstSix(run, site);
    await openGate(site);

    expect((await transitionProvisioningStep(cp, env, run, site, 'go_live', 'tehty')).ok).toBe(true);
    expect(await cp.latestProvisioningRunForSite(site.id)).toEqual(expect.objectContaining({ status: 'valmis' }));
    expect(await cp.getSiteByPublicId(site.publicId)).toEqual(expect.objectContaining({
      status: 'published',
      publishedVersion: site.currentVersion,
    }));
    const actions = (await cp.listAuditEvents({ entity: 'provisioning', entityId: run.publicId, limit: 30 }))
      .map((event) => event.action);
    expect(actions).toContain('provisioning.golive');
    expect(actions.filter((action) => action === 'provisioning.step')).toHaveLength(7);
  });

  it('enforces one active run, supports abort, and permits a later run', async () => {
    const site = await seed('active01');
    const first = await start(site, 'first.example');
    expect(await startProvisioningRun(cp, env, site, 'second.example'))
      .toEqual(expect.objectContaining({ ok: false, status: 409 }));
    await expect(cp.createProvisioningRun({
      publicId: 'forced02',
      site,
      domain: 'forced.example',
      steps: PROVISIONING_STEPS,
    })).rejects.toThrow(/UNIQUE/);
    expect((await abortProvisioningRun(cp, first)).ok).toBe(true);
    expect(await cp.latestProvisioningRunForSite(site.id)).toEqual(expect.objectContaining({
      status: 'keskeytetty',
    }));
    expect((await startProvisioningRun(cp, env, site, 'second.example')).ok).toBe(true);
    expect((await cp.listAuditEvents({ entity: 'provisioning', entityId: first.publicId, limit: 10 }))[0])
      .toEqual(expect.objectContaining({ action: 'provisioning.abort' }));
  });

  it('validates domains and seeds the domain renewal model', async () => {
    expect(validProvisioningDomain('yritys.fi')).toBe(true);
    for (const invalid of ['ab.fi', '-yritys.fi', 'Yritys.fi', 'yritys', 'yritys.c']) {
      expect(validProvisioningDomain(invalid)).toBe(false);
    }
    const site = await seed('renew001');
    const before = Date.now();
    await start(site, 'renew.example');
    const renewals = await cp.listRenewalsForSite(site.id);
    expect(renewals).toEqual([
      expect.objectContaining({ kind: 'domain', label: 'renew.example', status: 'tulossa' }),
    ]);
    expect(renewals[0]!.dueAt).toBeGreaterThanOrEqual(before + 365 * 24 * 60 * 60 * 1000);
    expect(await cp.listUpcomingRenewals()).toEqual([]);
    await env.DB.exec(`UPDATE renewals SET due_at = ${Date.now() + 10 * 24 * 60 * 60 * 1000}`);
    expect(await cp.listUpcomingRenewals()).toEqual([
      expect.objectContaining({ label: 'renew.example', sitePublicId: site.publicId }),
    ]);
  });

  it('shows console controls and renewals and exposes an operator-only GET API mirror', async () => {
    const site = await seed('console9');
    await start(site, 'console.example');
    const session = await signSessionCookie('operator-secret');
    const cookie = `pf_admin=${session.value}`;
    const detail = await worker.fetch(new Request('https://example.test/admin/sites/console9', {
      headers: { cookie },
    }), env);
    const detailHtml = await detail.text();
    expect(detailHtml).toContain('<h2>Provisiointi</h2>');
    expect(detailHtml).toContain('Domainin rekisteröinti');
    expect(detailHtml).toContain('console.example');
    expect(detailHtml).toContain('Merkitse tehdyksi');
    expect(detailHtml).toContain('Keskeytä provisiointi');

    const globalHtml = await (await worker.fetch(
      new Request('https://example.test/admin/provisioning', { headers: { cookie } }),
      env,
    )).text();
    expect(globalHtml).toContain('Käynnissä olevat ajot');
    expect(globalHtml).toContain('console.example');

    const denied = await worker.fetch(
      jsonRequest('/api/biz/sites/console9/provisioning', 'GET', undefined, 'approval-secret'),
      env,
    );
    expect(denied.status).toBe(403);
    const response = await worker.fetch(
      jsonRequest('/api/biz/sites/console9/provisioning', 'GET', undefined, 'operator-secret'),
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({
      run: expect.objectContaining({ domain: 'console.example', status: 'kaynnissa' }),
      steps: expect.arrayContaining([expect.objectContaining({ step: 'domain_register' })]),
      renewals: expect.arrayContaining([expect.objectContaining({ label: 'console.example' })]),
    }));
  });

  it('handles domain validation through the no-JS console', async () => {
    const site = await seed('domainui');
    const session = await signSessionCookie('operator-secret');
    const cookie = `pf_admin=${session.value}`;
    const detailHtml = await (await worker.fetch(new Request(
      'https://example.test/admin/sites/domainui',
      { headers: { cookie } },
    ), env)).text();
    const csrf = detailHtml.match(/name="csrf" value="([a-f0-9]{64})"/)![1]!;
    expect(detailHtml).toContain('pattern="^[a-z0-9][a-z0-9.-]{2,60}\\.[a-z]{2,10}$"');
    const invalid = await worker.fetch(formRequest(
      '/admin/sites/domainui/provisioning/start',
      { csrf, domain: 'bad_domain' },
      cookie,
    ), env);
    expect(invalid.status).toBe(400);
    expect(await invalid.text()).toContain('Virheellinen verkkotunnus');
  });
});
