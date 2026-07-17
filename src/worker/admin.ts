import {
  applyProposalDecision,
  bizHtml,
  publishSiteVersion,
  randomPreviewToken,
  rollbackSiteVersion,
  summarizeChanges,
} from './biz.js';
import {
  businessProfileWarnings,
  validateBusinessProfile,
} from './business-profile.js';
import { compose } from './composer.js';
import {
  ControlPlane,
  type Prospect,
  type ProspectStatus,
  PROSPECT_STATUSES,
  type Site,
  type UpdateRequestStatus,
} from './db.js';
import {
  auditPage,
  dashboardPage,
  intakePage,
  loginPage,
  messagePage,
  panelTokenPage,
  previewTokenPage,
  prospectDetailPage,
  prospectsPage,
  siteDetailPage,
  sitesPage,
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
import { constantTimeEqual, type Env, sha256Hex } from './shared.js';
import {
  LAUNCH_CHECKLIST_ITEMS,
  publishGate,
  publishGateError,
  runQaChecks,
} from './qa.js';
import { validateSiteData } from './validate.js';

const ADMIN_HEADERS = {
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex',
};

const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export const PROSPECT_TRANSITIONS: Readonly<Record<ProspectStatus, readonly ProspectStatus[]>> = {
  loytynyt: ['arvioitu', 'hylatty'],
  arvioitu: ['luonnos', 'hylatty'],
  luonnos: ['yhteydenotto', 'hylatty'],
  yhteydenotto: ['vastasi', 'hylatty'],
  vastasi: ['myyty', 'hylatty'],
  myyty: ['julkaistu'],
  julkaistu: ['yllapidossa'],
  yllapidossa: [],
  hylatty: ['arvioitu'],
};

/** The single validation point for every console prospect state change. */
export function validateProspectTransition(
  current: ProspectStatus,
  target: string,
  statusReason?: string,
): { status: ProspectStatus; statusReason?: string } | { error: string } {
  if (!PROSPECT_STATUSES.includes(target as ProspectStatus)) {
    return { error: 'Tuntematon prospektin tila.' };
  }
  const status = target as ProspectStatus;
  if (!PROSPECT_TRANSITIONS[current].includes(status)) {
    return { error: `Siirtymä ${current} → ${status} ei ole sallittu.` };
  }
  const reason = statusReason?.trim();
  if (status === 'hylatty' && !reason) {
    return { error: 'Hylkäyksen syy vaaditaan.' };
  }
  return { status, ...(reason ? { statusReason: reason } : {}) };
}

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

function formString(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === 'string' ? value : undefined;
}

function optionalFormString(form: FormData, name: string): string | undefined {
  const value = formString(form, name)?.trim();
  return value ? value : undefined;
}

async function readForm(request: Request): Promise<FormData | null> {
  try {
    return await request.formData();
  } catch {
    return null;
  }
}

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((byte) => ID_ALPHABET[byte % ID_ALPHABET.length]).join('');
}

async function unusedProspectId(cp: ControlPlane): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const id = randomId();
    if (!(await cp.getProspect(id))) return id;
  }
  throw new Error('could not allocate prospect id');
}

async function unusedProfileId(cp: ControlPlane): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const id = randomId();
    if (!(await cp.getBusinessProfileByPublicId(id))) return id;
  }
  throw new Error('could not allocate profile id');
}

async function unusedSiteId(cp: ControlPlane): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const id = randomId();
    if (!(await cp.getSiteByPublicId(id))) return id;
  }
  throw new Error('could not allocate site id');
}

async function unusedProposalId(cp: ControlPlane, siteId: number): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const id = randomId();
    if (!(await cp.getProposal(siteId, id))) return id;
  }
  throw new Error('could not allocate proposal id');
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
  const [versions, proposals, photoCount, events, tokens, panelTokens, updateRequests, comments, qaRun, checklist, gate] = await Promise.all([
    cp.listSnapshots(site.id),
    cp.listOpenProposals(site.id),
    cp.photoCountForSite(site.id),
    cp.listAuditEventsForSite(site.publicId, 20),
    cp.listActiveTokens(site.id),
    cp.listActivePanelTokens(site.id),
    cp.listUpdateRequests(undefined, site.id),
    cp.listDraftComments(site.id),
    cp.latestQaRun(site.id),
    cp.listLaunchChecklist(site.id),
    publishGate(cp, site),
  ]);
  return html(siteDetailPage({
    site,
    versions,
    proposals,
    photoCount,
    events,
    tokens,
    panelTokens,
    updateRequests: updateRequests.filter((entry) => entry.status !== 'suljettu'),
    comments,
    qaRun: qaRun ?? undefined,
    checklist,
    publishGateMessage: publishGateError(gate),
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
    const existing = await cp.getBusinessProfileByProspectId(prospect.id);
    if (request.method === 'GET') {
      const profile = existing?.data ?? emptyBusinessProfile(prospect);
      return html(intakePage({
        prospect,
        profile,
        csrf,
        warnings: businessProfileWarnings(profile, prospect),
      }));
    }
    if (request.method !== 'POST') return methodNotAllowed(csrf);
    const profile = parseBusinessProfileForm(form!, prospect);
    const errors = validateBusinessProfile(profile);
    if (errors.length) {
      return html(intakePage({
        prospect,
        profile,
        csrf,
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
    const invalid = variants.map(validateSiteData).find((error) => error !== null);
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
