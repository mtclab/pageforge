import { publishSiteVersion, siteMutable, type Operation } from './biz.js';
import {
  ControlPlane,
  type ProvisioningRun,
  type ProvisioningStep,
  type ProvisioningStepStatus,
  type Site,
} from './db.js';
import { type Env, unusedId } from './shared.js';
import { vendorAdapters, type VendorAdapters, type VendorResult } from './vendors.js';

export const PROVISIONING_STEPS = [
  { id: 'domain_register', ord: 1, label: 'Domainin rekisteröinti' },
  { id: 'dns_zone', ord: 2, label: 'DNS-vyöhyke' },
  { id: 'email_mailbox', ord: 3, label: 'Sähköpostilaatikko / forward' },
  { id: 'hostname_attach', ord: 4, label: 'Hostname kytketty hostingiin' },
  { id: 'tls_cert', ord: 5, label: 'TLS-varmenne' },
  { id: 'http_check', ord: 6, label: 'HTTP-tarkistus' },
  { id: 'go_live', ord: 7, label: 'Julkaisu' },
] as const;

export type ProvisioningStepId = typeof PROVISIONING_STEPS[number]['id'];

export const DOMAIN_RE = /^[a-z0-9][a-z0-9.-]{2,60}\.[a-z]{2,10}$/;

const HTTP_TIMEOUT_MS = 10_000;

export function validProvisioningDomain(domain: string): boolean {
  return DOMAIN_RE.test(domain);
}

async function unusedRunId(cp: ControlPlane): Promise<string> {
  return unusedId((id) => cp.getProvisioningRunByPublicId(id), 'provisioning run');
}

export async function startProvisioningRun(
  cp: ControlPlane,
  env: Env,
  site: Site,
  domain: string,
  adapters: VendorAdapters = vendorAdapters(env),
): Promise<Operation<ProvisioningRun>> {
  const immutable = siteMutable(site);
  if (immutable) return immutable;
  const normalized = domain.trim();
  if (!validProvisioningDomain(normalized)) {
    return { ok: false, status: 400, error: 'Virheellinen verkkotunnus.' };
  }
  if (await cp.activeProvisioningRunForSite(site.id)) {
    return { ok: false, status: 409, error: 'Sivustolla on jo käynnissä oleva provisiointi.' };
  }
  const order = await cp.latestOrderForSite(site.id);
  let run: ProvisioningRun;
  try {
    run = await cp.createProvisioningRun({
      publicId: await unusedRunId(cp),
      site,
      ...(order === null ? {} : { orderId: order.id }),
      domain: normalized,
      steps: PROVISIONING_STEPS,
    });
  } catch (error) {
    // The partial unique index is authoritative; translate a concurrent start
    // into the same console response as the optimistic pre-check.
    if (await cp.activeProvisioningRunForSite(site.id)) {
      return { ok: false, status: 409, error: 'Sivustolla on jo käynnissä oleva provisiointi.' };
    }
    throw error;
  }
  await advanceProvisioningAdapters(cp, env, run, site, adapters);
  return { ok: true, value: run };
}

async function realHttpCheck(
  domain: string,
  fetcher: typeof fetch,
): Promise<{ ok: true; evidence: string } | { ok: false; evidence: string; error: string }> {
  const target = `https://${domain}/`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const response = await fetcher(target, { signal: controller.signal });
    const evidence = `GET ${target} -> ${response.status}`;
    return response.status < 400
      ? { ok: true, evidence }
      : { ok: false, evidence, error: `HTTP-tarkistus palautti tilan ${response.status}.` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      evidence: `GET ${target} -> virhe: ${message}`,
      error: `HTTP-tarkistus epäonnistui: ${message}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * The one validation and mutation boundary for every provisioning step state
 * change, whether initiated by an operator, a real HTTP probe, or an adapter.
 */
export async function transitionProvisioningStep(
  cp: ControlPlane,
  env: Env,
  run: ProvisioningRun,
  site: Site,
  stepId: string,
  status: Exclude<ProvisioningStepStatus, 'odottaa'>,
  evidence?: string,
  fetcher: typeof fetch = fetch,
): Promise<Operation<ProvisioningStep>> {
  const immutable = siteMutable(site);
  if (immutable) return immutable;
  if (run.siteId !== site.id) {
    return { ok: false, status: 400, error: 'Provisiointi ei kuulu sivustolle.' };
  }
  if (run.status !== 'kaynnissa') {
    return { ok: false, status: 409, error: 'Provisiointi ei ole käynnissä.' };
  }
  const definition = PROVISIONING_STEPS.find((entry) => entry.id === stepId);
  if (!definition) return { ok: false, status: 400, error: 'Tuntematon provisiointivaihe.' };
  const steps = await cp.listProvisioningSteps(run.id);
  const step = steps.find((entry) => entry.step === stepId);
  if (!step) return { ok: false, status: 400, error: 'Provisiointivaihe puuttuu.' };

  let storedEvidence = evidence?.trim();
  if (status === 'tehty') {
    const blocking = steps.filter((entry) => entry.ord < definition.ord)
      .find((entry) => entry.status !== 'tehty' && entry.status !== 'ohitettu');
    if (blocking) {
      return { ok: false, status: 400, error: `Edeltävä vaihe ${blocking.step} ei ole valmis.` };
    }

    if (stepId === 'http_check' && env.VERIFY_HTTP_ENABLED === 'true') {
      const verification = await realHttpCheck(run.domain, fetcher);
      storedEvidence = verification.evidence;
      if (!verification.ok) {
        await cp.setProvisioningStep({
          run,
          step: stepId,
          status: 'epaonnistui',
          evidence: storedEvidence,
        });
        return { ok: false, status: 400, error: verification.error };
      }
    } else if (stepId !== 'go_live' && !storedEvidence) {
      return { ok: false, status: 400, error: 'Valmis vaihe vaatii operaattorin evidenssin.' };
    }

    if (stepId === 'go_live') {
      const order = await cp.latestOrderForSite(site.id);
      if (order && !(await cp.siteIsEntitled(site.id))) {
        return { ok: false, status: 409, error: 'Tilaus ei ole maksettu.' };
      }
      const published = await publishSiteVersion(cp, site, site.currentVersion, 'operator');
      if (!published.ok) return published;
      await cp.completeProvisioningRun({
        run,
        step: stepId,
        ...(storedEvidence === undefined ? {} : { evidence: storedEvidence }),
      });
      return {
        ok: true,
        value: { ...step, status: 'tehty', ...(storedEvidence ? { evidence: storedEvidence } : {}) },
      };
    }
  }

  await cp.setProvisioningStep({
    run,
    step: stepId,
    status,
    ...(storedEvidence === undefined ? {} : { evidence: storedEvidence }),
  });
  return {
    ok: true,
    value: {
      ...step,
      status,
      ...(storedEvidence === undefined ? {} : { evidence: storedEvidence }),
    },
  };
}

function adapterCall(
  adapters: VendorAdapters,
  run: ProvisioningRun,
  step: ProvisioningStep,
): Promise<VendorResult> | undefined {
  if (step.step === 'domain_register') return adapters.domain.register(run.domain);
  if (step.step === 'email_mailbox') return adapters.mail.provision(`info@${run.domain}`);
  if (step.step === 'hostname_attach') return adapters.hostname.attach(run.domain);
  return undefined;
}

/** Run eligible vendor-backed steps until manual work or a non-vendor step is reached. */
export async function advanceProvisioningAdapters(
  cp: ControlPlane,
  env: Env,
  run: ProvisioningRun,
  site: Site,
  adapters: VendorAdapters = vendorAdapters(env),
): Promise<void> {
  while (true) {
    const steps = await cp.listProvisioningSteps(run.id);
    const next = steps.find((step) => step.status !== 'tehty' && step.status !== 'ohitettu');
    if (!next || next.status === 'epaonnistui') return;
    const pending = adapterCall(adapters, run, next);
    if (!pending) return;
    const result = await pending;
    if (result.mode === 'manual') return;
    if (result.mode === 'failed') {
      await transitionProvisioningStep(
        cp,
        env,
        run,
        site,
        next.step,
        'epaonnistui',
        result.error,
      );
      return;
    }
    const transitioned = await transitionProvisioningStep(
      cp,
      env,
      run,
      site,
      next.step,
      'tehty',
      result.evidence,
    );
    if (!transitioned.ok) return;
  }
}

export async function abortProvisioningRun(
  cp: ControlPlane,
  run: ProvisioningRun,
): Promise<Operation<null>> {
  if (run.status !== 'kaynnissa') {
    return { ok: false, status: 409, error: 'Provisiointi ei ole käynnissä.' };
  }
  await cp.abortProvisioningRun(run);
  return { ok: true, value: null };
}
