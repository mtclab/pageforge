import {
  applyProposalDecision,
  bizHtml,
  publishSiteVersion,
  randomPreviewToken,
  rollbackSiteVersion,
  siteMutable,
  storeSitePhoto,
  summarizeChanges,
} from './biz.js';
import {
  BUSINESS_PROFILE_LIMITS,
  businessProfileWarnings,
  validateBusinessProfile,
} from './business-profile.js';
import { compose } from './composer.js';
import {
  ControlPlane,
  type ClaimStatus,
  CLAIM_STATUSES,
  type Prospect,
  type ProspectStatus,
  PROSPECT_STATUSES,
  type Site,
  type UpdateRequestStatus,
} from './db.js';
import {
  createOrderCheckout,
  OpenOrderError,
  unusedOrderId,
} from './payments.js';
import {
  auditPage,
  claimsPage,
  dashboardPage,
  deletionsPage,
  intakePage,
  loginPage,
  messagePage,
  panelTokenPage,
  previewTokenPage,
  provisioningPage,
  prospectDetailPage,
  prospectsPage,
  siteDetailPage,
  sitesPage,
  transferPage,
  updatesPage,
} from './admin-html.js';
import { emptyBusinessProfile, parseBusinessProfileForm } from './intake-form.js';
import {
  checkCsrfToken,
  clearSessionCookie,
  makeCsrfToken,
  readSessionCookie,
  setSessionCookie,
  signSessionCookie,
  verifySessionCookie,
} from './session.js';
import {
  bizRenderCachePrefix,
  constantTimeEqual,
  type Env,
  formString,
  optionalFormString,
  randomId,
  sha256Hex,
  unusedId,
} from './shared.js';
import {
  LAUNCH_CHECKLIST_ITEMS,
  publishGate,
  publishGateError,
  runQaChecks,
} from './qa.js';
import {
  abortProvisioningRun,
  advanceProvisioningAdapters,
  startProvisioningRun,
  transitionProvisioningStep,
} from './provisioning.js';
import { validateSiteData } from './validate.js';
import {
  PROSPECT_TRANSITIONS,
  validateProspectTransition,
} from './prospect-status.js';

export { PROSPECT_TRANSITIONS, validateProspectTransition } from './prospect-status.js';

const ADMIN_HEADERS = {
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex',
};

function html(body: string, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', ADMIN_HEADERS['cache-control']);
  headers.set('x-robots-tag', ADMIN_HEADERS['x-robots-tag']);
  return new Response(body, { status, headers });
}

function redirect(location: string, cookie?: string): Response {
  const headers = new Headers({ ...ADMIN_HEADERS, location });
  if (cookie !== undefined) headers.set('set-cookie', cookie);
  return new Response(null, { status: 303, headers });
}

async function readForm(request: Request): Promise<FormData | null> {
  try {
    return await request.formData();
  } catch {
    return null;
  }
}

async function unusedProspectId(cp: ControlPlane): Promise<string> {
  return unusedId((id) => cp.getProspect(id), 'prospect');
}

async function unusedProfileId(cp: ControlPlane): Promise<string> {
  return unusedId((id) => cp.getBusinessProfileByPublicId(id), 'profile');
}

async function unusedSiteId(cp: ControlPlane): Promise<string> {
  return unusedId((id) => cp.getSiteByPublicId(id), 'site');
}

async function unusedProposalId(cp: ControlPlane, siteId: number): Promise<string> {
  return unusedId((id) => cp.getProposal(siteId, id), 'proposal');
}

function methodNotAllowed(csrf?: string): Response {
  return html(
    csrf === undefined
      ? loginPage('Metodi ei ole sallittu.')
      : messagePage('Metodi ei ole sallittu', 'Tämä reitti ei tue pyydettyä metodia.', csrf),
    405,
    { allow: 'GET, POST' },
  );
}

async function purgeSiteRenderCache(env: Env, sitePublicId: string): Promise<number> {
  const prefix = bizRenderCachePrefix(sitePublicId);
  let cursor: string | undefined;
  let count = 0;
  do {
    const page = await env.SITES.list({ prefix, ...(cursor === undefined ? {} : { cursor }) });
    await Promise.all(page.keys.map((key) => env.SITES.delete(key.name)));
    count += page.keys.length;
    if (page.list_complete || !page.cursor) break;
    cursor = page.cursor;
  } while (true);
  return count;
}

async function prospectDetailResponse(
  cp: ControlPlane,
  prospect: Prospect,
  csrf: string,
  error?: string,
  status = 200,
): Promise<Response> {
  const [profile, site] = await Promise.all([
    cp.getBusinessProfileByProspectId(prospect.id),
    cp.getSiteByProspectId(prospect.id),
  ]);
  return html(
    prospectDetailPage(
      prospect,
      csrf,
      PROSPECT_TRANSITIONS[prospect.status],
      error,
      profile ?? undefined,
      profile ? businessProfileWarnings(profile.data, prospect) : [],
      site ?? undefined,
    ),
    status,
  );
}

async function siteDetailResponse(
  cp: ControlPlane,
  site: Site,
  csrf: string,
  error?: string,
  status = 200,
): Promise<Response> {
  const [versions, proposals, photos, events, tokens, panelTokens, updateRequests, comments, qaRun, checklist, order, claim, billingEvents, provisioningRun, renewals] = await Promise.all([
    cp.listSnapshots(site.id),
    cp.listOpenProposals(site.id),
    cp.listPhotoMetaForSite(site.id),
    cp.listAuditEventsForSite(site.publicId, 20),
    cp.listActiveTokens(site.id),
    cp.listActivePanelTokens(site.id),
    cp.listUpdateRequests(undefined, site.id),
    cp.listDraftComments(site.id),
    cp.latestQaRun(site.id),
    cp.listLaunchChecklist(site.id),
    cp.latestOrderForSite(site.id),
    cp.latestClaimForSite(site.id),
    cp.listBillingEventsForSite(site.id, 20),
    cp.latestProvisioningRunForSite(site.id),
    cp.listRenewalsForSite(site.id),
  ]);
  const gate = await publishGate(cp, site, site.currentVersion, {
    run: qaRun,
    checklist,
  });
  const provisioningSteps = provisioningRun === null
    ? []
    : await cp.listProvisioningSteps(provisioningRun.id);
  return html(siteDetailPage({
    site,
    versions,
    proposals,
    photos,
    events,
    tokens,
    panelTokens,
    updateRequests: updateRequests.filter((entry) => entry.status !== 'suljettu'),
    comments,
    qaRun: qaRun ?? undefined,
    checklist,
    publishGateMessage: publishGateError(gate),
    order: order ?? undefined,
    claim: claim ?? undefined,
    billingEvents,
    provisioningRun: provisioningRun ?? undefined,
    provisioningSteps,
    renewals,
    csrf,
    ...(error === undefined ? {} : { error }),
  }), status);
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  if (request.method === 'GET') return html(loginPage());
  if (request.method !== 'POST') return methodNotAllowed();
  const form = await readForm(request);
  const submitted = form ? formString(form, 'key') ?? '' : '';
  const matches = constantTimeEqual(
    await sha256Hex(submitted),
    await sha256Hex(env.OPERATOR_KEY ?? ''),
  );
  if (!matches) return html(loginPage('Väärä operaattoriavain.'), 403);
  const session = await signSessionCookie(env.OPERATOR_KEY!);
  return redirect('/admin', setSessionCookie(session.value, session.expiry));
}

export async function handleAdminRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  if (pathname === '/admin/login') return handleLogin(request, env);

  const sessionExpiry = await verifySessionCookie(
    readSessionCookie(request),
    env.OPERATOR_KEY ?? '',
  );
  if (sessionExpiry === null) return redirect('/admin/login');
  const csrf = await makeCsrfToken(env.OPERATOR_KEY!, sessionExpiry);
  const cp = new ControlPlane(env.DB);

  let form: FormData | undefined;
  if (request.method === 'POST') {
    form = (await readForm(request)) ?? new FormData();
    if (!(await checkCsrfToken(formString(form, 'csrf'), env.OPERATOR_KEY!, sessionExpiry))) {
      return html(messagePage('Pyyntö estettiin', 'CSRF-tunniste puuttuu tai on virheellinen.', csrf), 403);
    }
  }

  if (pathname === '/admin/logout') {
    if (request.method !== 'POST') return methodNotAllowed(csrf);
    return redirect('/admin/login', clearSessionCookie());
  }

  if (pathname === '/admin') {
    if (request.method !== 'GET') return methodNotAllowed(csrf);
    const [counts, events] = await Promise.all([
      cp.countsByStatus(),
      cp.listAuditEvents({ limit: 20 }),
    ]);
    return html(dashboardPage(counts, events, csrf));
  }

  if (pathname === '/admin/updates') {
    if (request.method !== 'GET') return methodNotAllowed(csrf);
    const rawStatus = url.searchParams.get('status') ?? undefined;
    if (rawStatus !== undefined && !['uusi', 'ehdotettu', 'suljettu'].includes(rawStatus)) {
      return html(updatesPage(await cp.listUpdateRequests(), csrf, undefined, 'Tuntematon tilasuodatin.'), 400);
    }
    const status = rawStatus as UpdateRequestStatus | undefined;
    return html(updatesPage(await cp.listUpdateRequests(status), csrf, status));
  }

  if (pathname === '/admin/claims') {
    if (request.method !== 'GET') return methodNotAllowed(csrf);
    const rawStatus = url.searchParams.get('status') ?? undefined;
    if (rawStatus !== undefined && !CLAIM_STATUSES.includes(rawStatus as ClaimStatus)) {
      return html(claimsPage(await cp.listClaims(), csrf, undefined, 'Tuntematon tilasuodatin.'), 400);
    }
    const status = rawStatus as ClaimStatus | undefined;
    return html(claimsPage(await cp.listClaims(status), csrf, status));
  }

  if (pathname === '/admin/provisioning') {
    if (request.method !== 'GET') return methodNotAllowed(csrf);
    const [runs, renewals] = await Promise.all([
      cp.listActiveProvisioningRuns(),
      cp.listUpcomingRenewals(),
    ]);
    return html(provisioningPage(runs, renewals, csrf));
  }

  if (pathname === '/admin/deletions') {
    if (request.method !== 'GET') return methodNotAllowed(csrf);
    const rawBefore = url.searchParams.get('before') ?? undefined;
    const before = rawBefore === undefined ? undefined : Number(rawBefore);
    if (before !== undefined && (!Number.isInteger(before) || before <= 0)) {
      return html(messagePage('Virheellinen sivutus', 'before-parametrin pitää olla positiivinen ID.', csrf), 400);
    }
    const entries = await cp.listDeletionLog({
      limit: 50,
      ...(before === undefined ? {} : { before }),
    });
    return html(deletionsPage(
      entries,
      csrf,
      entries.length < 50 ? undefined : entries[entries.length - 1]!.id,
    ));
  }

  const updateCloseMatch = pathname.match(/^\/admin\/updates\/(\d+)\/close$/);
  if (updateCloseMatch) {
    if (request.method !== 'POST') return methodNotAllowed(csrf);
    const closed = await cp.closeUpdateRequest(Number(updateCloseMatch[1]!), 'operator');
    if (!closed) {
      return html(updatesPage(await cp.listUpdateRequests(), csrf, undefined, 'Päivityspyyntöä ei löytynyt tai se on jo suljettu.'), 404);
    }
    return redirect('/admin/updates');
  }

  if (pathname === '/admin/prospects') {
    if (request.method === 'GET') {
      const rawStatus = url.searchParams.get('status') ?? undefined;
      if (rawStatus !== undefined && !PROSPECT_STATUSES.includes(rawStatus as ProspectStatus)) {
        return html(prospectsPage(await cp.listProspects(), csrf, undefined, 'Tuntematon tilasuodatin.'), 400);
      }
      const status = rawStatus as ProspectStatus | undefined;
      return html(prospectsPage(await cp.listProspects(status), csrf, status));
    }
    if (request.method !== 'POST') return methodNotAllowed(csrf);
    const name = formString(form!, 'name')?.trim() ?? '';
    if (!name) {
      return html(prospectsPage(await cp.listProspects(), csrf, undefined, 'Nimi vaaditaan.'), 400);
    }
    const publicId = await unusedProspectId(cp);
    await cp.createProspect({
      publicId,
      name,
      status: 'loytynyt',
      actor: 'operator',
      ...(optionalFormString(form!, 'yTunnus') === undefined ? {} : { yTunnus: optionalFormString(form!, 'yTunnus') }),
      ...(optionalFormString(form!, 'municipality') === undefined ? {} : { municipality: optionalFormString(form!, 'municipality') }),
      ...(optionalFormString(form!, 'vertical') === undefined ? {} : { vertical: optionalFormString(form!, 'vertical') }),
      ...(optionalFormString(form!, 'source') === undefined ? {} : { source: optionalFormString(form!, 'source') }),
      ...(optionalFormString(form!, 'contactEmail') === undefined ? {} : { contactEmail: optionalFormString(form!, 'contactEmail') }),
      ...(optionalFormString(form!, 'contactPhone') === undefined ? {} : { contactPhone: optionalFormString(form!, 'contactPhone') }),
      ...(optionalFormString(form!, 'notes') === undefined ? {} : { notes: optionalFormString(form!, 'notes') }),
    });
    return redirect(`/admin/prospects/${publicId}`);
  }

  const prospectStatusMatch = pathname.match(/^\/admin\/prospects\/([^/]+)\/status$/);
  if (prospectStatusMatch) {
    if (request.method !== 'POST') return methodNotAllowed(csrf);
    const publicId = prospectStatusMatch[1]!;
    const prospect = await cp.getProspect(publicId);
    if (!prospect) return html(messagePage('Prospektia ei löytynyt', 'Tuntematon prospekti.', csrf), 404);
    const validation = validateProspectTransition(
      prospect.status,
      formString(form!, 'status') ?? '',
      formString(form!, 'statusReason'),
    );
    if ('error' in validation) return prospectDetailResponse(cp, prospect, csrf, validation.error, 400);
    await cp.updateProspectStatus({
      publicId,
      status: validation.status,
      actor: 'operator',
      ...(validation.statusReason === undefined ? {} : { statusReason: validation.statusReason }),
    });
    return redirect(`/admin/prospects/${publicId}`);
  }

  const prospectIntakeMatch = pathname.match(/^\/admin\/prospects\/([^/]+)\/intake$/);
  if (prospectIntakeMatch) {
    const prospect = await cp.getProspect(prospectIntakeMatch[1]!);
    if (!prospect) return html(messagePage('Prospektia ei löytynyt', 'Tuntematon prospekti.', csrf), 404);
    const [existing, existingSite] = await Promise.all([
      cp.getBusinessProfileByProspectId(prospect.id),
      cp.getSiteByProspectId(prospect.id),
    ]);
    if (request.method === 'GET') {
      const profile = existing?.data ?? emptyBusinessProfile(prospect);
      return html(intakePage({
        prospect,
        profile,
        csrf,
        hasSite: existingSite !== null,
        warnings: businessProfileWarnings(profile, prospect),
      }));
    }
    if (request.method !== 'POST') return methodNotAllowed(csrf);
    const profile = parseBusinessProfileForm(form!, prospect);
    const addRows = formString(form!, 'add_rows');
    if (addRows && Object.prototype.hasOwnProperty.call(BUSINESS_PROFILE_LIMITS, addRows)) {
      const prefix = addRows as keyof typeof BUSINESS_PROFILE_LIMITS;
      let rendered = 0;
      const pattern = new RegExp(`^${prefix}_(\\d+)_`);
      for (const key of form!.keys()) {
        const index = Number(key.match(pattern)?.[1]);
        if (Number.isInteger(index)) rendered = Math.max(rendered, index + 1);
      }
      return html(intakePage({
        prospect,
        profile,
        csrf,
        hasSite: existingSite !== null,
        warnings: businessProfileWarnings(profile, prospect),
        rowCounts: { [prefix]: Math.min(BUSINESS_PROFILE_LIMITS[prefix] * 2, rendered + 3) },
      }));
    }
    const errors = validateBusinessProfile(profile);
    if (errors.length) {
      return html(intakePage({
        prospect,
        profile,
        csrf,
        hasSite: existingSite !== null,
        errors,
        warnings: businessProfileWarnings(profile, prospect),
      }), 400);
    }
    await cp.upsertBusinessProfile({
      publicId: existing?.publicId ?? await unusedProfileId(cp),
      prospectId: prospect.id,
      data: profile,
      actor: 'operator',
    });
    return redirect(`/admin/prospects/${prospect.publicId}`);
  }

  const prospectComposeMatch = pathname.match(/^\/admin\/prospects\/([^/]+)\/compose$/);
  if (prospectComposeMatch) {
    if (request.method !== 'POST') return methodNotAllowed(csrf);
    const prospect = await cp.getProspect(prospectComposeMatch[1]!);
    if (!prospect) return html(messagePage('Prospektia ei löytynyt', 'Tuntematon prospekti.', csrf), 404);
    if (await cp.getSiteByProspectId(prospect.id)) {
      return prospectDetailResponse(cp, prospect, csrf, 'Prospektilla on jo sivusto.', 400);
    }
    const profile = await cp.getBusinessProfileByProspectId(prospect.id);
    if (!profile) return prospectDetailResponse(cp, prospect, csrf, 'BusinessProfile puuttuu.', 400);
    const profileErrors = validateBusinessProfile(profile.data);
    if (profileErrors.length) {
      return prospectDetailResponse(cp, prospect, csrf, profileErrors.join(' '), 400);
    }
    const variants = compose(profile.data, profile.publicId);
    const invalid = variants
      .map((variant) => validateSiteData(variant, { allowR2Photos: true }))
      .find((error) => error !== null);
    if (invalid) return prospectDetailResponse(cp, prospect, csrf, `Koostaminen epäonnistui: ${invalid}`, 400);
    const sitePublicId = await unusedSiteId(cp);
    await cp.createSite({
      publicId: sitePublicId,
      prospectId: prospect.id,
      approvalKeyHash: await sha256Hex(`${randomId()}${randomId()}`),
      data: variants[0]!,
      actor: 'operator',
    });
    const site = (await cp.getSiteByPublicId(sitePublicId))!;
    for (const [index, candidate] of variants.slice(1).entries()) {
      await cp.createProposal({
        site,
        publicId: await unusedProposalId(cp, site.id),
        candidate,
        summary: summarizeChanges(site.data, candidate),
        note: `Koostettu variantti ${index + 2}`,
        actor: 'operator',
      });
    }
    return redirect(`/admin/sites/${sitePublicId}`);
  }

  const prospectMatch = pathname.match(/^\/admin\/prospects\/([^/]+)$/);
  if (prospectMatch) {
    if (request.method !== 'GET') return methodNotAllowed(csrf);
    const prospect = await cp.getProspect(prospectMatch[1]!);
    return prospect
      ? prospectDetailResponse(cp, prospect, csrf)
      : html(messagePage('Prospektia ei löytynyt', 'Tuntematon prospekti.', csrf), 404);
  }

  if (pathname === '/admin/sites') {
    if (request.method !== 'GET') return methodNotAllowed(csrf);
    return html(sitesPage(await cp.listSites(), csrf));
  }

  const transferMatch = pathname.match(/^\/admin\/sites\/([^/]+)\/transfer$/);
  if (transferMatch) {
    if (request.method !== 'GET') return methodNotAllowed(csrf);
    const site = await cp.getSiteByPublicId(transferMatch[1]!);
    if (!site) return html(messagePage('Sivustoa ei löytynyt', 'Tuntematon sivusto.', csrf), 404);
    const run = await cp.latestProvisioningRunForSite(site.id);
    return html(transferPage(site, run?.domain));
  }

  const offboardingMatch = pathname.match(/^\/admin\/sites\/([^/]+)\/(archive|restore|delete)$/);
  if (offboardingMatch) {
    if (request.method !== 'POST') return methodNotAllowed(csrf);
    const site = await cp.getSiteByPublicId(offboardingMatch[1]!);
    if (!site) return html(messagePage('Sivustoa ei löytynyt', 'Tuntematon sivusto.', csrf), 404);
    const action = offboardingMatch[2]!;
    if (action === 'archive') {
      if (site.status === 'archived') return siteDetailResponse(cp, site, csrf, 'Sivusto on jo arkistoitu.', 400);
      if (formString(form!, 'confirm') !== 'true') {
        return siteDetailResponse(cp, site, csrf, 'Vahvista arkistointi.', 400);
      }
      const cachePurged = await purgeSiteRenderCache(env, site.publicId);
      await cp.archiveSite(site, cachePurged, 'operator');
      return redirect(`/admin/sites/${site.publicId}`);
    }
    if (action === 'restore') {
      if (site.status !== 'archived') return siteDetailResponse(cp, site, csrf, 'Vain arkistoidun sivuston voi palauttaa.', 400);
      await cp.restoreSite(site, 'operator');
      return redirect(`/admin/sites/${site.publicId}`);
    }
    if (site.status !== 'archived') {
      return siteDetailResponse(cp, site, csrf, 'Sivusto pitää arkistoida ennen pysyvää poistoa.', 400);
    }
    if (formString(form!, 'confirm') !== site.publicId) {
      return siteDetailResponse(cp, site, csrf, 'Vahvistus ei vastaa sivuston ID:tä.', 400);
    }
    await cp.permanentlyDeleteSite(
      site,
      'operator',
      (photoKeys) => env.PHOTOS.delete(photoKeys),
    );
    return redirect('/admin/deletions');
  }

  const photoUploadMatch = pathname.match(/^\/admin\/sites\/([^/]+)\/photos$/);
  if (photoUploadMatch) {
    if (request.method !== 'POST') return methodNotAllowed(csrf);
    const site = await cp.getSiteByPublicId(photoUploadMatch[1]!);
    if (!site) return html(messagePage('Sivustoa ei löytynyt', 'Tuntematon sivusto.', csrf), 404);
    const photo = form!.get('photo');
    if (photo === null || typeof photo === 'string') {
      return siteDetailResponse(cp, site, csrf, 'Valitse ladattava kuva.', 400);
    }
    const stored = await storeSitePhoto(env, cp, site, await photo.arrayBuffer(), photo.type);
    if (!stored.ok) return siteDetailResponse(cp, site, csrf, stored.error, stored.status);
    return redirect(`/admin/sites/${site.publicId}#photos`);
  }

  const provisioningStartMatch = pathname.match(/^\/admin\/sites\/([^/]+)\/provisioning\/start$/);
  if (provisioningStartMatch) {
    if (request.method !== 'POST') return methodNotAllowed(csrf);
    const site = await cp.getSiteByPublicId(provisioningStartMatch[1]!);
    if (!site) return html(messagePage('Sivustoa ei löytynyt', 'Tuntematon sivusto.', csrf), 404);
    const result = await startProvisioningRun(cp, env, site, formString(form!, 'domain') ?? '');
    if (!result.ok) return siteDetailResponse(cp, site, csrf, result.error, result.status);
    return redirect(`/admin/sites/${site.publicId}`);
  }

  const provisioningStepMatch = pathname.match(/^\/admin\/sites\/([^/]+)\/provisioning\/steps\/([^/]+)$/);
  if (provisioningStepMatch) {
    if (request.method !== 'POST') return methodNotAllowed(csrf);
    const site = await cp.getSiteByPublicId(provisioningStepMatch[1]!);
    if (!site) return html(messagePage('Sivustoa ei löytynyt', 'Tuntematon sivusto.', csrf), 404);
    const run = await cp.activeProvisioningRunForSite(site.id);
    if (!run) return siteDetailResponse(cp, site, csrf, 'Käynnissä olevaa provisiointia ei löytynyt.', 404);
    const rawStatus = formString(form!, 'status');
    if (rawStatus !== 'tehty' && rawStatus !== 'ohitettu') {
      return siteDetailResponse(cp, site, csrf, 'Tuntematon provisiointivaiheen tila.', 400);
    }
    const result = await transitionProvisioningStep(
      cp,
      env,
      run,
      site,
      provisioningStepMatch[2]!,
      rawStatus,
      formString(form!, 'evidence'),
    );
    if (!result.ok) return siteDetailResponse(cp, site, csrf, result.error, result.status);
    await advanceProvisioningAdapters(cp, env, run, site);
    return redirect(`/admin/sites/${site.publicId}`);
  }

  const provisioningAbortMatch = pathname.match(/^\/admin\/sites\/([^/]+)\/provisioning\/abort$/);
  if (provisioningAbortMatch) {
    if (request.method !== 'POST') return methodNotAllowed(csrf);
    const site = await cp.getSiteByPublicId(provisioningAbortMatch[1]!);
    if (!site) return html(messagePage('Sivustoa ei löytynyt', 'Tuntematon sivusto.', csrf), 404);
    const run = await cp.activeProvisioningRunForSite(site.id);
    if (!run) return siteDetailResponse(cp, site, csrf, 'Käynnissä olevaa provisiointia ei löytynyt.', 404);
    const result = await abortProvisioningRun(cp, run);
    if (!result.ok) return siteDetailResponse(cp, site, csrf, result.error, result.status);
    return redirect(`/admin/sites/${site.publicId}`);
  }

  const proposalMatch = pathname.match(/^\/admin\/sites\/([^/]+)\/proposals\/([^/]+)\/(approve|reject)$/);
  if (proposalMatch) {
    if (request.method !== 'POST') return methodNotAllowed(csrf);
    const [, siteId, proposalId, decision] = proposalMatch;
    const site = await cp.getSiteByPublicId(siteId!);
    if (!site) return html(messagePage('Sivustoa ei löytynyt', 'Tuntematon sivusto.', csrf), 404);
    const result = await applyProposalDecision(
      cp,
      site,
      proposalId!,
      decision as 'approve' | 'reject',
      'operator',
    );
    if (!result.ok) return siteDetailResponse(cp, site, csrf, result.error, result.status);
    return redirect(`/admin/sites/${site.publicId}`);
  }

  const rollbackMatch = pathname.match(/^\/admin\/sites\/([^/]+)\/rollback$/);
  if (rollbackMatch) {
    if (request.method !== 'POST') return methodNotAllowed(csrf);
    const site = await cp.getSiteByPublicId(rollbackMatch[1]!);
    if (!site) return html(messagePage('Sivustoa ei löytynyt', 'Tuntematon sivusto.', csrf), 404);
    const to = Number(formString(form!, 'to'));
    if (!Number.isInteger(to)) return siteDetailResponse(cp, site, csrf, 'Virheellinen versio.', 400);
    const result = await rollbackSiteVersion(cp, site, to, 'operator');
    if (!result.ok) return siteDetailResponse(cp, site, csrf, result.error, result.status);
    return redirect(`/admin/sites/${site.publicId}`);
  }

  const qaMatch = pathname.match(/^\/admin\/sites\/([^/]+)\/qa$/);
  if (qaMatch) {
    if (request.method !== 'POST') return methodNotAllowed(csrf);
    const site = await cp.getSiteByPublicId(qaMatch[1]!);
    if (!site) return html(messagePage('Sivustoa ei löytynyt', 'Tuntematon sivusto.', csrf), 404);
    const results = await runQaChecks(site.data, bizHtml(site.data, false), cp);
    await cp.recordQaRun(site, site.currentVersion, results, 'operator');
    return redirect(`/admin/sites/${site.publicId}`);
  }

  const orderMatch = pathname.match(/^\/admin\/sites\/([^/]+)\/order$/);
  if (orderMatch) {
    if (request.method !== 'POST') return methodNotAllowed(csrf);
    const site = await cp.getSiteByPublicId(orderMatch[1]!);
    if (!site) return html(messagePage('Sivustoa ei löytynyt', 'Tuntematon sivusto.', csrf), 404);
    const immutable = siteMutable(site);
    if (immutable) return siteDetailResponse(cp, site, csrf, immutable.error, immutable.status);
    try {
      const checkout = await createOrderCheckout(
        cp,
        env,
        site,
        url.origin,
        await unusedOrderId(cp),
        'operator',
      );
      return redirect(checkout.redirectUrl);
    } catch (error) {
      if (error instanceof OpenOrderError) {
        return siteDetailResponse(cp, site, csrf, 'Sivustolla on jo avoin tilaus.', 409);
      }
      throw error;
    }
  }

  const checklistCombinedMatch = pathname.match(/^\/admin\/sites\/([^/]+)\/checklist$/);
  if (checklistCombinedMatch) {
    if (request.method !== 'POST') return methodNotAllowed(csrf);
    const site = await cp.getSiteByPublicId(checklistCombinedMatch[1]!);
    if (!site) return html(messagePage('Sivustoa ei löytynyt', 'Tuntematon sivusto.', csrf), 404);
    const checked = new Set((await cp.listLaunchChecklist(site.id)).map((entry) => entry.item));
    const selected = new Set([
      ...form!.getAll('items').filter((value): value is string => typeof value === 'string'),
      ...LAUNCH_CHECKLIST_ITEMS.filter((item) => formString(form!, item.id) === 'true').map((item) => item.id),
    ]);
    for (const item of LAUNCH_CHECKLIST_ITEMS) {
      if (selected.has(item.id) && !checked.has(item.id)) {
        await cp.checkLaunchChecklist(site, item.id, 'operator');
      } else if (!selected.has(item.id) && checked.has(item.id)) {
        await cp.uncheckLaunchChecklist(site, item.id);
      }
    }
    return redirect(`/admin/sites/${site.publicId}#julkaisu`);
  }

  const checklistMatch = pathname.match(/^\/admin\/sites\/([^/]+)\/checklist\/([^/]+)$/);
  if (checklistMatch) {
    if (request.method !== 'POST') return methodNotAllowed(csrf);
    const site = await cp.getSiteByPublicId(checklistMatch[1]!);
    if (!site) return html(messagePage('Sivustoa ei löytynyt', 'Tuntematon sivusto.', csrf), 404);
    const item = checklistMatch[2]!;
    if (!LAUNCH_CHECKLIST_ITEMS.some((entry) => entry.id === item)) {
      return siteDetailResponse(cp, site, csrf, 'Tuntematon tarkistuslistan kohta.', 400);
    }
    if (formString(form!, 'checked') === 'true') await cp.checkLaunchChecklist(site, item, 'operator');
    else await cp.uncheckLaunchChecklist(site, item);
    return redirect(`/admin/sites/${site.publicId}`);
  }

  const tokenRevokeMatch = pathname.match(/^\/admin\/sites\/([^/]+)\/tokens\/(\d+)\/revoke$/);
  if (tokenRevokeMatch) {
    if (request.method !== 'POST') return methodNotAllowed(csrf);
    const site = await cp.getSiteByPublicId(tokenRevokeMatch[1]!);
    if (!site) return html(messagePage('Sivustoa ei löytynyt', 'Tuntematon sivusto.', csrf), 404);
    const revoked = await cp.revokePreviewToken({
      id: Number(tokenRevokeMatch[2]!),
      site,
      actor: 'operator',
    });
    if (!revoked) return siteDetailResponse(cp, site, csrf, 'Esikatselutunnistetta ei löytynyt.', 404);
    return redirect(`/admin/sites/${site.publicId}`);
  }

  const panelTokenRevokeMatch = pathname.match(/^\/admin\/sites\/([^/]+)\/panel-tokens\/(\d+)\/revoke$/);
  if (panelTokenRevokeMatch) {
    if (request.method !== 'POST') return methodNotAllowed(csrf);
    const site = await cp.getSiteByPublicId(panelTokenRevokeMatch[1]!);
    if (!site) return html(messagePage('Sivustoa ei löytynyt', 'Tuntematon sivusto.', csrf), 404);
    const revoked = await cp.revokePanelToken({
      id: Number(panelTokenRevokeMatch[2]!),
      site,
      actor: 'operator',
    });
    if (!revoked) return siteDetailResponse(cp, site, csrf, 'Asiakaspaneelin tunnistetta ei löytynyt.', 404);
    return redirect(`/admin/sites/${site.publicId}`);
  }

  const panelTokenCreateMatch = pathname.match(/^\/admin\/sites\/([^/]+)\/panel-tokens$/);
  if (panelTokenCreateMatch) {
    if (request.method !== 'POST') return methodNotAllowed(csrf);
    const site = await cp.getSiteByPublicId(panelTokenCreateMatch[1]!);
    if (!site) return html(messagePage('Sivustoa ei löytynyt', 'Tuntematon sivusto.', csrf), 404);
    const token = randomPreviewToken();
    await cp.createPanelToken({ tokenHash: await sha256Hex(token), site, actor: 'operator' });
    const panelUrl = `${new URL(request.url).origin}/panel?t=${encodeURIComponent(token)}`;
    return html(panelTokenPage(site, panelUrl, csrf));
  }

  const tokenCreateMatch = pathname.match(/^\/admin\/sites\/([^/]+)\/tokens$/);
  if (tokenCreateMatch) {
    if (request.method !== 'POST') return methodNotAllowed(csrf);
    const site = await cp.getSiteByPublicId(tokenCreateMatch[1]!);
    if (!site) return html(messagePage('Sivustoa ei löytynyt', 'Tuntematon sivusto.', csrf), 404);
    const label = formString(form!, 'label')?.trim() ?? '';
    const days = Number(formString(form!, 'days'));
    const proposalPublicId = optionalFormString(form!, 'proposal');
    if (!label || label.length > 100) {
      return siteDetailResponse(cp, site, csrf, 'Nimen pitää olla 1–100 merkkiä.', 400);
    }
    if (!Number.isInteger(days) || days < 1 || days > 60) {
      return siteDetailResponse(cp, site, csrf, 'Voimassaolon pitää olla 1–60 päivää.', 400);
    }
    if (proposalPublicId !== undefined) {
      const proposal = await cp.getProposal(site.id, proposalPublicId);
      if (!proposal || proposal.status !== 'open') {
        return siteDetailResponse(cp, site, csrf, 'Avoimen ehdotuksen tunniste on virheellinen.', 400);
      }
    }
    const token = randomPreviewToken();
    await cp.createPreviewToken({
      tokenHash: await sha256Hex(token),
      site,
      ...(proposalPublicId === undefined ? {} : { proposalPublicId }),
      label,
      expiresAt: Date.now() + days * 24 * 60 * 60 * 1000,
      actor: 'operator',
    });
    const target = proposalPublicId ?? 'current';
    const previewUrl = `${new URL(request.url).origin}/p/${site.publicId}/${target}?t=${token}`;
    return html(previewTokenPage(site, previewUrl, csrf));
  }

  const publishMatch = pathname.match(/^\/admin\/sites\/([^/]+)\/(publish|unpublish)$/);
  if (publishMatch) {
    if (request.method !== 'POST') return methodNotAllowed(csrf);
    const site = await cp.getSiteByPublicId(publishMatch[1]!);
    if (!site) return html(messagePage('Sivustoa ei löytynyt', 'Tuntematon sivusto.', csrf), 404);
    if (publishMatch[2] === 'unpublish') {
      const immutable = siteMutable(site);
      if (immutable) return siteDetailResponse(cp, site, csrf, immutable.error, immutable.status);
      await cp.unpublishSite(site, 'operator');
      return redirect(`/admin/sites/${site.publicId}`);
    }
    const rawN = optionalFormString(form!, 'n');
    const n = rawN === undefined ? site.currentVersion : Number(rawN);
    const result = await publishSiteVersion(cp, site, n, 'operator', {
      requested: formString(form!, 'override') === 'true',
      reason: formString(form!, 'reason'),
    });
    if (!result.ok) return siteDetailResponse(cp, site, csrf, result.error, result.status);
    return redirect(`/admin/sites/${site.publicId}`);
  }

  const siteMatch = pathname.match(/^\/admin\/sites\/([^/]+)$/);
  if (siteMatch) {
    if (request.method !== 'GET') return methodNotAllowed(csrf);
    const site = await cp.getSiteByPublicId(siteMatch[1]!);
    return site
      ? siteDetailResponse(cp, site, csrf)
      : html(messagePage('Sivustoa ei löytynyt', 'Tuntematon sivusto.', csrf), 404);
  }

  if (pathname === '/admin/audit') {
    if (request.method !== 'GET') return methodNotAllowed(csrf);
    const rawBefore = url.searchParams.get('before') ?? undefined;
    const before = rawBefore === undefined ? undefined : Number(rawBefore);
    if (before !== undefined && (!Number.isInteger(before) || before <= 0)) {
      return html(messagePage('Virheellinen sivutus', 'before-parametrin pitää olla positiivinen ID.', csrf), 400);
    }
    const entity = url.searchParams.get('entity')?.trim() || undefined;
    const entityId = url.searchParams.get('entityId')?.trim() || undefined;
    const events = await cp.listAuditEvents({
      limit: 50,
      ...(entity === undefined ? {} : { entity }),
      ...(entityId === undefined ? {} : { entityId }),
      ...(before === undefined ? {} : { before }),
    });
    return html(auditPage({
      events,
      csrf,
      ...(entity === undefined ? {} : { entity }),
      ...(entityId === undefined ? {} : { entityId }),
      ...(events.length < 50 ? {} : { nextBefore: events[events.length - 1]!.id }),
    }));
  }

  return html(messagePage('Sivua ei löytynyt', 'Tuntematon admin-reitti.', csrf), 404);
}

export function adminNotFound(): Response {
  return new Response('Not found', { status: 404, headers: ADMIN_HEADERS });
}
