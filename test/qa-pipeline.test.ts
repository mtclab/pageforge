import { beforeEach, describe, expect, it } from 'vitest';
import type { SiteData } from '../src/engine/types.js';
import { bizHtml } from '../src/worker/biz.js';
import { ControlPlane, type Site } from '../src/worker/db.js';
import worker from '../src/worker/index.js';
import {
  LAUNCH_CHECKLIST_ITEMS,
  runQaChecks,
} from '../src/worker/qa.js';
import { sha256Hex } from '../src/worker/shared.js';
import { signSessionCookie } from '../src/worker/session.js';
import bizFood from './fixtures/biz-food.json';
import { jsonRequest, workerEnv } from './worker-fixture.js';

const PHOTO_HASH = 'a'.repeat(64);
const base = {
  ...(bizFood as SiteData),
  photo: { src: `/img/${PHOTO_HASH}` },
} as SiteData;

function formRequest(path: string, fields: Record<string, string>, cookie?: string): Request {
  return new Request(`https://example.test${path}`, {
    method: 'POST',
    headers: cookie ? { cookie } : undefined,
    body: new URLSearchParams(fields),
  });
}

describe('S6 deterministic QA checks', () => {
  let env: ReturnType<typeof workerEnv>;
  let cp: ControlPlane;
  let html: string;

  beforeEach(async () => {
    env = workerEnv();
    cp = new ControlPlane(env.DB);
    await cp.putPhotoMeta({
      r2Key: `photos/${PHOTO_HASH}`,
      contentType: 'image/jpeg',
      bytes: 10,
      actor: 'operator',
    });
    html = bizHtml(base, false);
  });

  const failures: { id: string; make: (data: SiteData, page: string) => [SiteData, string] }[] = [
    { id: 'facts.name', make: (data, page) => [{ ...data, name: '   ' }, page] },
    {
      id: 'facts.hours',
      make: (data, page) => [{
        ...data,
        sections: data.sections.map((section) => section.kind === 'hours'
          ? { ...section, days: [{ label: 'Ma', open: '09:00', close: '09:00' }] }
          : section),
      }, page],
    },
    { id: 'facts.phone', make: (data, page) => [data, page.replaceAll('tel:+358 40 123 4567', 'tel:123')] },
    { id: 'links.schemes', make: (data, page) => [data, page.replace('</main>', '<a href="javascript:alert(1)">x</a></main>')] },
    { id: 'links.photos', make: (data, page) => [data, page.replaceAll(PHOTO_HASH, 'b'.repeat(64))] },
    { id: 'a11y.h1', make: (data, page) => [data, page.replace('</main>', '<h1>Toinen</h1></main>')] },
    { id: 'a11y.headings', make: (data, page) => [data, page.replace(/(<main\b[^>]*>)/, '$1<h3>Hyppy</h3>')] },
    { id: 'a11y.imgAlt', make: (data, page) => [data, page.replace(/ alt="[^"]*"/, '')] },
    { id: 'a11y.lang', make: (data, page) => [data, page.replace(/<html lang="[^"]*">/, '<html>')] },
    { id: 'size.html', make: (data, page) => [data, `${page}${'x'.repeat(256 * 1024)}`] },
    { id: 'size.sections', make: (data, page) => [{
      ...data,
      sections: Array.from({ length: 21 }, () => ({ kind: 'about', text: 'x' } as const)),
    }, page] },
    { id: 'seo.jsonld', make: (data, page) => [data, page.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/, '')] },
    { id: 'seo.title', make: (data, page) => [data, page.replace(/<title>[\s\S]*?<\/title>/, '<title> </title>')] },
  ];

  it.each(failures)('$id has a passing and failing fixture', async ({ id, make }) => {
    const passing = await runQaChecks(base, html, cp);
    expect(passing.find((result) => result.id === id)).toEqual(
      expect.objectContaining({ id, passed: true }),
    );

    const [data, page] = make(base, html);
    const failing = await runQaChecks(data, page, cp);
    expect(failing.find((result) => result.id === id)).toEqual(
      expect.objectContaining({ id, passed: false }),
    );
  });

  it('aggregates the fixed table in order with details on failures', async () => {
    const results = await runQaChecks(
      { ...base, name: '' },
      html.replace(/<title>[\s\S]*?<\/title>/, '<title></title>'),
      cp,
    );
    expect(results).toHaveLength(13);
    expect(results.map((result) => result.id)).toEqual(failures.map(({ id }) => id));
    expect(results.filter((result) => !result.passed).map((result) => result.id)).toEqual([
      'facts.name',
      'seo.title',
    ]);
    expect(results.find((result) => result.id === 'facts.name')?.detail).toBeTruthy();
  });
});

describe('S6 persistence, checklist, and publish gate', () => {
  let env: ReturnType<typeof workerEnv>;
  let cp: ControlPlane;

  beforeEach(() => {
    env = workerEnv();
    cp = new ControlPlane(env.DB);
  });

  async function seed(publicId: string, approvalKey = 'approval-secret'): Promise<Site> {
    await cp.createSite({
      publicId,
      approvalKeyHash: await sha256Hex(approvalKey),
      data: base,
      actor: 'operator',
    });
    return (await cp.getSiteByPublicId(publicId))!;
  }

  async function checkAll(site: Site): Promise<void> {
    for (const item of LAUNCH_CHECKLIST_ITEMS) {
      await cp.checkLaunchChecklist(site, item.id, 'operator');
    }
  }

  it('persists the latest run and audits its aggregate result', async () => {
    const site = await seed('qaruns01');
    await cp.recordQaRun(site, 0, [{ id: 'one', label: 'One', passed: true }]);
    const latest = await cp.recordQaRun(site, 0, [
      { id: 'one', label: 'One', passed: true },
      { id: 'two', label: 'Two', passed: false, detail: 'rikki' },
    ]);

    expect(await cp.latestQaRun(site.id)).toEqual(latest);
    expect(latest.passed).toBe(false);
    const audit = await cp.listAuditEvents({ entity: 'site', entityId: site.publicId, limit: 10 });
    expect(audit[0]).toEqual(expect.objectContaining({
      actor: 'operator',
      action: 'qa.run',
      detail: { version: 0, passed: false, failCount: 1 },
    }));
  });

  it('toggles checklist state and audits check and uncheck', async () => {
    const site = await seed('check001');
    await cp.checkLaunchChecklist(site, 'copy_reviewed', 'operator');
    expect(await cp.listLaunchChecklist(site.id)).toEqual([
      expect.objectContaining({ item: 'copy_reviewed', checkedBy: 'operator' }),
    ]);
    await cp.uncheckLaunchChecklist(site, 'copy_reviewed');
    expect(await cp.listLaunchChecklist(site.id)).toEqual([]);
    const audit = await cp.listAuditEvents({ entity: 'site', entityId: site.publicId, limit: 10 });
    expect(audit.map((event) => event.action).slice(0, 2)).toEqual([
      'checklist.uncheck',
      'checklist.check',
    ]);
  });

  it('blocks publishing without a current passing run and with unchecked items', async () => {
    const noRun = await seed('norun001');
    await checkAll(noRun);
    const missingRun = await worker.fetch(
      jsonRequest('/api/biz/sites/norun001/publish', 'POST', {}, 'approval-secret'),
      env,
    );
    expect(missingRun.status).toBe(409);
    expect((await missingRun.json() as { error: string }).error).toContain('QA-tarkistus versiolle 0');

    const failed = await seed('failed01');
    await checkAll(failed);
    await cp.recordQaRun(failed, 0, [{ id: 'x', label: 'X', passed: false }]);
    expect((await worker.fetch(
      jsonRequest('/api/biz/sites/failed01/publish', 'POST', {}, 'approval-secret'), env,
    )).status).toBe(409);

    const unchecked = await seed('uncheck1');
    await cp.recordQaRun(unchecked, 0, [{ id: 'x', label: 'X', passed: true }]);
    const response = await worker.fetch(
      jsonRequest('/api/biz/sites/uncheck1/publish', 'POST', {}, 'approval-secret'), env,
    );
    expect(response.status).toBe(409);
    expect((await response.json() as { error: string }).error).toContain('FI-kieli tarkastettu');
  });

  it('requires a passed QA run for the exact historical version being published', async () => {
    let site = await seed('exactqa1');
    for (let version = 1; version <= 10; version++) {
      await cp.updateSiteData(site, { ...base, name: `Versio ${version}` }, {
        actor: 'operator', action: 'fixture.promote', entity: 'site', entityId: site.publicId,
      });
      site = (await cp.getSiteByPublicId(site.publicId))!;
    }
    await checkAll(site);
    await cp.recordQaRun(site, 10, [{ id: 'ok', label: 'OK', passed: true }]);

    const response = await worker.fetch(
      jsonRequest('/api/biz/sites/exactqa1/publish', 'POST', { n: 4 }, 'operator-secret'),
      env,
    );
    expect(response.status).toBe(409);
    expect((await response.json() as { error: string }).error).toContain('QA-tarkistus versiolle 4');
    expect((await cp.getSiteByPublicId('exactqa1'))?.publishedVersion).toBeUndefined();
  });

  it('allows and audits an operator override with a reason but never gives approval keys an override', async () => {
    const operatorSite = await seed('override');
    const missingReason = await worker.fetch(
      jsonRequest('/api/biz/sites/override/publish', 'POST', { override: true }, 'operator-secret'), env,
    );
    expect(missingReason.status).toBe(400);
    const allowed = await worker.fetch(
      jsonRequest('/api/biz/sites/override/publish', 'POST', { override: true, reason: 'Kiireellinen avaus' }, 'operator-secret'), env,
    );
    expect(allowed.status).toBe(200);
    const audit = await cp.listAuditEvents({ entity: 'site', entityId: operatorSite.publicId, limit: 10 });
    expect(audit[0]).toEqual(expect.objectContaining({
      action: 'site.publish',
      detail: { n: 0, override: 'Kiireellinen avaus' },
    }));

    await seed('customer');
    const denied = await worker.fetch(
      jsonRequest('/api/biz/sites/customer/publish', 'POST', { override: true, reason: 'Asiakas' }, 'approval-secret'), env,
    );
    expect(denied.status).toBe(409);
    expect((await cp.getSiteByPublicId('customer'))?.publishedVersion).toBeUndefined();
  });

  it('runs QA and toggles the checklist from the no-JS console', async () => {
    const site = await seed('consoleq');
    await cp.putPhotoMeta({
      r2Key: `photos/${PHOTO_HASH}`,
      siteId: site.id,
      contentType: 'image/jpeg',
      bytes: 10,
      actor: 'operator',
    });
    const session = await signSessionCookie('operator-secret');
    const cookie = `pf_admin=${session.value}`;
    const detail = await worker.fetch(new Request('https://example.test/admin/sites/consoleq', {
      headers: { cookie },
    }), env);
    const detailHtml = await detail.text();
    const csrf = detailHtml.match(/name="csrf" value="([a-f0-9]{64})"/)![1]!;
    expect(detailHtml).toContain('Aja tarkistukset');
    expect(detailHtml).toContain('Julkaisuportti ei täyty');

    const blocked = await worker.fetch(formRequest(
      '/admin/sites/consoleq/publish',
      { csrf },
      cookie,
    ), env);
    expect(blocked.status).toBe(409);
    expect(await blocked.text()).toContain('Julkaisun ehdot puuttuvat');

    const override = await worker.fetch(formRequest(
      '/admin/sites/consoleq/publish',
      { csrf, override: 'true', reason: 'Avataan ennen domainia' },
      cookie,
    ), env);
    expect(override.status).toBe(303);
    expect((await cp.listAuditEvents({ entity: 'site', entityId: site.publicId, limit: 10 }))[0]).toEqual(
      expect.objectContaining({
        action: 'site.publish',
        detail: { n: 0, override: 'Avataan ennen domainia' },
      }),
    );

    const run = await worker.fetch(formRequest('/admin/sites/consoleq/qa', { csrf }, cookie), env);
    expect(run.status).toBe(303);
    expect((await cp.latestQaRun(site.id))?.passed).toBe(true);

    const checked = await worker.fetch(formRequest(
      '/admin/sites/consoleq/checklist/copy_reviewed',
      { csrf, checked: 'true' },
      cookie,
    ), env);
    expect(checked.status).toBe(303);
    expect((await cp.listLaunchChecklist(site.id)).map((item) => item.item)).toEqual(['copy_reviewed']);

    const unchecked = await worker.fetch(formRequest(
      '/admin/sites/consoleq/checklist/copy_reviewed',
      { csrf },
      cookie,
    ), env);
    expect(unchecked.status).toBe(303);
    expect(await cp.listLaunchChecklist(site.id)).toEqual([]);
  });
});
