import {
  applyProposalDecision,
  rollbackSiteVersion,
} from './biz.js';
import {
  ControlPlane,
  type Prospect,
  type ProspectStatus,
  PROSPECT_STATUSES,
  type Site,
} from './db.js';
import {
  auditPage,
  dashboardPage,
  loginPage,
  messagePage,
  prospectDetailPage,
  prospectsPage,
  siteDetailPage,
  sitesPage,
} from './admin-html.js';
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
  prospect: Prospect,
  csrf: string,
  error?: string,
  status = 200,
): Promise<Response> {
  return html(
    prospectDetailPage(prospect, csrf, PROSPECT_TRANSITIONS[prospect.status], error),
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
  const [versions, proposals, photoCount, events] = await Promise.all([
    cp.listSnapshots(site.id),
    cp.listOpenProposals(site.id),
    cp.photoCountForSite(site.id),
    cp.listAuditEventsForSite(site.publicId, 20),
  ]);
  return html(siteDetailPage({
    site,
    versions,
    proposals,
    photoCount,
    events,
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
    if ('error' in validation) return prospectDetailResponse(prospect, csrf, validation.error, 400);
    await cp.updateProspectStatus({
      publicId,
      status: validation.status,
      actor: 'operator',
      ...(validation.statusReason === undefined ? {} : { statusReason: validation.statusReason }),
    });
    return redirect(`/admin/prospects/${publicId}`);
  }

  const prospectMatch = pathname.match(/^\/admin\/prospects\/([^/]+)$/);
  if (prospectMatch) {
    if (request.method !== 'GET') return methodNotAllowed(csrf);
    const prospect = await cp.getProspect(prospectMatch[1]!);
    return prospect
      ? prospectDetailResponse(prospect, csrf)
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
