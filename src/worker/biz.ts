import { renderSite } from '../engine/render.js';
import { renderLocalBusinessJsonLd } from '../engine/jsonld.js';
import { escAttr } from '../engine/escape.js';
import type { SiteData } from '../engine/types.js';
import { getTheme } from '../themes/index.js';
import {
  type AuditActor,
  ControlPlane,
  type OpenProposal,
  type Site,
} from './db.js';
import {
  bearerToken,
  constantTimeEqual,
  type Env,
  json,
  readJson,
  requireOperator,
  sha256Hex,
} from './shared.js';
import { readSessionCookie, verifySessionCookie } from './session.js';
import { publishGate, publishGateError } from './qa.js';
import { validateSiteData } from './validate.js';

export interface ProposalInfo {
  proposalId: string;
  previewPath: string;
  summary: string[];
}

export interface SiteView {
  data: SiteData;
  versions: { n: number; at: number; note?: string }[];
  openProposals: string[];
  status: Site['status'];
  publishedVersion?: number;
}

export type Operation<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const PROPOSALS_PER_DAY = 50;
const RENDER_CACHE_TTL = 7 * 24 * 60 * 60;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const PREVIEW_TOKEN_TTL = 14 * 24 * 60 * 60 * 1000;
const PHOTO_TYPES = new Map<string, true>([
  ['image/jpeg', true],
  ['image/png', true],
  ['image/webp', true],
]);

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((byte) => ID_ALPHABET[byte % ID_ALPHABET.length]).join('');
}

export function randomPreviewToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function unusedSiteId(cp: ControlPlane): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const id = randomId();
    if (!(await cp.getSiteByPublicId(id))) return id;
  }
  throw new Error('could not allocate id');
}

async function unusedProposalId(cp: ControlPlane, siteId: number): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const id = randomId();
    if (!(await cp.getProposal(siteId, id))) return id;
  }
  throw new Error('could not allocate id');
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, stableValue(entry)]),
    );
  }
  return value;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(stableValue(a)) === JSON.stringify(stableValue(b));
}

export function summarizeChanges(current: SiteData, candidate: SiteData): string[] {
  const summary: string[] = [];
  const currentRecord = current as unknown as Record<string, unknown>;
  const candidateRecord = candidate as unknown as Record<string, unknown>;
  const topLevel = [...new Set([...Object.keys(currentRecord), ...Object.keys(candidateRecord)])]
    .filter((key) => key !== 'sections')
    .sort();
  for (const key of topLevel) {
    if (!sameValue(currentRecord[key], candidateRecord[key])) summary.push(`${key} changed`);
  }

  const kinds = [...new Set([
    ...current.sections.map((section) => section.kind),
    ...candidate.sections.map((section) => section.kind),
  ])].sort();
  for (const kind of kinds) {
    const before = current.sections.filter((section) => section.kind === kind);
    const after = candidate.sections.filter((section) => section.kind === kind);
    if (!before.length) summary.push(`sections/${kind} added`);
    else if (!after.length) summary.push(`sections/${kind} removed`);
    else if (!sameValue(before, after)) summary.push(`sections/${kind} changed`);
  }
  return summary;
}

/** The control-plane site, or null. Exported for the MCP tools. */
export async function getBizSite(env: Env, siteId: string): Promise<Site | null> {
  return new ControlPlane(env.DB).getSiteByPublicId(siteId);
}

/** Shared read model for GET /api/biz/sites/:id and the MCP get_site tool. */
export async function siteView(env: Env, site: Site): Promise<SiteView> {
  const cp = new ControlPlane(env.DB);
  const snapshots = await cp.listSnapshots(site.id);
  const openProposals = await cp.listOpenProposals(site.id);
  return {
    data: site.data,
    versions: snapshots.map(({ n, at, note }) => ({ n, at, ...(note === undefined ? {} : { note }) })),
    openProposals: openProposals.map(({ proposalId }) => proposalId),
    status: site.status,
    ...(site.publishedVersion === undefined ? {} : { publishedVersion: site.publishedVersion }),
  };
}

/** Open proposal metadata for the MCP list_proposals tool. */
export async function listOpenProposals(env: Env, siteId: string): Promise<OpenProposal[]> {
  const cp = new ControlPlane(env.DB);
  const site = await cp.getSiteByPublicId(siteId);
  if (!site) return [];
  return cp.listOpenProposals(site.id);
}

async function proposalRateLimit(env: Env, siteId: string): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  const key = `bizrl:${siteId}:${day}`;
  const count = Number((await env.SITES.get(key)) ?? '0');
  if (count >= PROPOSALS_PER_DAY) return false;
  await env.SITES.put(key, String(count + 1), { expirationTtl: 90_000 });
  return true;
}

export async function createProposal(
  env: Env,
  siteId: string,
  candidate: SiteData,
  note: string | undefined,
  actor: AuditActor,
): Promise<Operation<ProposalInfo>> {
  const cp = new ControlPlane(env.DB);
  const site = await cp.getSiteByPublicId(siteId);
  if (!site) return { ok: false, status: 404, error: 'Site not found.' };
  const invalid = validateSiteData(candidate);
  if (invalid) return { ok: false, status: 400, error: invalid };
  if (note !== undefined && (typeof note !== 'string' || note.length > 300)) {
    return { ok: false, status: 400, error: 'bad proposal note' };
  }
  if (!(await proposalRateLimit(env, siteId))) {
    return { ok: false, status: 429, error: 'Too many proposals today.' };
  }
  const proposalId = await unusedProposalId(cp, site.id);
  const summary = summarizeChanges(site.data, candidate);
  await cp.createProposal({
    site,
    publicId: proposalId,
    candidate,
    summary,
    actor,
    ...(note === undefined ? {} : { note }),
  });
  const token = randomPreviewToken();
  await cp.createPreviewToken({
    tokenHash: await sha256Hex(token),
    site,
    proposalPublicId: proposalId,
    label: 'auto',
    expiresAt: Date.now() + PREVIEW_TOKEN_TTL,
    actor,
  });
  return {
    ok: true,
    value: { proposalId, previewPath: `/p/${siteId}/${proposalId}?t=${token}`, summary },
  };
}

/** Shared proposal decision used by both the JSON API and operator console. */
export async function applyProposalDecision(
  cp: ControlPlane,
  site: Site,
  proposalId: string,
  decision: 'approve' | 'reject',
  actor: Extract<AuditActor, 'operator' | 'approval-key'>,
): Promise<Operation<number | null>> {
  const proposal = await cp.getProposal(site.id, proposalId);
  if (!proposal || proposal.status !== 'open') {
    return { ok: false, status: 404, error: 'Open proposal not found.' };
  }
  if (decision === 'reject') {
    await cp.rejectProposal(site.id, proposalId, {
      actor,
      action: 'proposal.reject',
      entity: 'proposal',
      entityId: proposalId,
      detail: { siteId: site.publicId },
    });
    return { ok: true, value: null };
  }
  const version = await cp.approveProposal(site, proposal, {
    actor,
    action: 'proposal.approve',
    entity: 'site',
    entityId: site.publicId,
    detail: { proposalId, version: site.currentVersion + 1 },
  });
  return { ok: true, value: version };
}

/** Shared rollback used by both the JSON API and operator console. */
export async function rollbackSiteVersion(
  cp: ControlPlane,
  site: Site,
  to: number,
  actor: Extract<AuditActor, 'operator' | 'approval-key'>,
): Promise<Operation<number>> {
  const version = await cp.rollbackSite(site, to, {
    actor,
    action: 'site.rollback',
    entity: 'site',
    entityId: site.publicId,
    detail: { to, version: site.currentVersion + 1 },
  });
  return version === null
    ? { ok: false, status: 400, error: 'Version not found.' }
    : { ok: true, value: version };
}

export async function publishSiteVersion(
  cp: ControlPlane,
  site: Site,
  n: number,
  actor: Extract<AuditActor, 'operator' | 'approval-key'>,
  override?: { requested: boolean; reason?: string },
): Promise<Operation<number>> {
  if (!Number.isInteger(n) || n < 0) {
    return { ok: false, status: 400, error: 'Invalid version.' };
  }
  if (n !== site.currentVersion && !(await cp.getSnapshot(site.id, n))) {
    return { ok: false, status: 400, error: 'Version not found.' };
  }
  let overrideReason: string | undefined;
  if (actor === 'operator' && override?.requested) {
    overrideReason = override.reason?.trim();
    if (!overrideReason) return { ok: false, status: 400, error: 'Ohituksen syy vaaditaan.' };
  } else {
    const gate = await publishGate(cp, site);
    if (!gate.passed) return { ok: false, status: 409, error: publishGateError(gate) };
  }
  await cp.publishSiteVersion(site, n, actor, overrideReason);
  return { ok: true, value: n };
}

type SiteAuth = { actor: Extract<AuditActor, 'operator' | 'approval-key'> };

async function siteAuth(request: Request, env: Env, site: Site): Promise<SiteAuth | Response> {
  const token = bearerToken(request);
  if (!token) return json(401, { error: 'Authorization required.' });
  const tokenHash = await sha256Hex(token);
  const operatorHash = await sha256Hex(env.OPERATOR_KEY ?? '');
  if (constantTimeEqual(tokenHash, operatorHash)) return { actor: 'operator' };
  if (constantTimeEqual(tokenHash, site.approvalKeyHash)) return { actor: 'approval-key' };
  return json(403, { error: 'Forbidden.' });
}

function methodNotAllowed(): Response {
  return json(405, { error: 'Method not allowed.' });
}

/** Render the business page HTML. Draft adds the preview banner. */
export function bizHtml(
  data: SiteData,
  draft: boolean,
  noindex = true,
  comment?: { action: string; token: string },
): string {
  const theme = getTheme(data.meta.themeId);
  const rendered = renderSite(data, theme, { heroCta: true });
  let html = rendered.html
    .replace('<link rel="stylesheet" href="style.css">', `<style>\n${rendered.css}</style>`);
  if (noindex) {
    html = html.replace('<head>', '<head>\n<meta name="robots" content="noindex">');
  }
  const jsonLd = renderLocalBusinessJsonLd(data);
  if (jsonLd) html = html.replace('</head>', `${jsonLd}\n</head>`);
  if (draft) {
    const banner = '<div style="position:fixed;z-index:9999;top:0;left:0;right:0;padding:.35rem 1rem;text-align:center;background:var(--accent);color:var(--accent-contrast);font:600 .875rem/1.4 sans-serif">Luonnos - esikatselu</div>';
    const feedback = comment === undefined ? '' : `<form action="${escAttr(comment.action)}" method="post" style="position:relative;z-index:9998;margin:2.5rem auto 1rem;max-width:40rem;padding:1rem;background:#fff;color:#111;border:1px solid #bbb;font:400 1rem/1.4 sans-serif"><input type="hidden" name="t" value="${escAttr(comment.token)}"><label style="display:grid;gap:.4rem;font-weight:600">Kommentti<textarea name="body" required maxlength="2000" style="min-height:6rem;padding:.5rem"></textarea></label><button type="submit" style="margin-top:.6rem;padding:.45rem .8rem">Lähetä kommentti</button></form>`;
    html = html.replace(/(<body[^>]*>)/, `$1\n${banner}${feedback}`);
  } else if (data.meta.hideBranding !== true) {
    html = html.replace('</footer>', '<p class="mikoshi-credit">Sivut: Mikoshi</p>\n</footer>');
  }
  return html;
}

type PreviewAccess = { viaToken: boolean; token: string };

async function previewAccess(
  request: Request,
  env: Env,
  cp: ControlPlane,
  site: Site,
  proposalPublicId?: string,
): Promise<PreviewAccess | null> {
  const token = new URL(request.url).searchParams.get('t') ?? '';
  if (token) {
    const record = await cp.findPreviewToken(await sha256Hex(token));
    if (
      record
      && record.siteId === site.id
      && record.revokedAt === undefined
      && record.expiresAt > Date.now()
      && (record.proposalPublicId === undefined || record.proposalPublicId === proposalPublicId)
    ) {
      return { viaToken: true, token };
    }
  }
  const session = await verifySessionCookie(
    readSessionCookie(request),
    env.OPERATOR_KEY ?? '',
  );
  return session === null ? null : { viaToken: false, token };
}

function previewCommentAction(siteId: string, proposalId: string, token: string): string {
  const base = `/p/${siteId}/${proposalId}/comments`;
  return token ? `${base}?t=${encodeURIComponent(token)}` : base;
}

function bizPageResponse(html: string, noindex = true): Response {
  const headers: Record<string, string> = {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  };
  if (noindex) headers['x-robots-tag'] = 'noindex';
  return new Response(html, {
    headers,
  });
}

async function sha256HexBytes(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function photoContentType(request: Request): string | null {
  const raw = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
  return PHOTO_TYPES.has(raw) ? raw : null;
}

export async function handleBizRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const cp = new ControlPlane(env.DB);

  if (pathname === '/api/biz/sites') {
    if (request.method !== 'POST') return methodNotAllowed();
    const denied = await requireOperator(request, env);
    if (denied) return denied;
    const parsed = await readJson<{ data?: SiteData }>(request);
    if ('error' in parsed) return parsed.error;
    if (!parsed.value.data) return json(400, { error: 'Missing page data.' });
    const invalid = validateSiteData(parsed.value.data);
    if (invalid) return json(400, { error: invalid });
    const id = await unusedSiteId(cp);
    const approvalKey = crypto.randomUUID();
    await cp.createSite({
      publicId: id,
      approvalKeyHash: await sha256Hex(approvalKey),
      data: parsed.value.data,
      actor: 'operator',
    });
    return json(200, { id, approvalKey });
  }

  const siteMatch = pathname.match(/^\/api\/biz\/sites\/([a-z0-9]{8})$/);
  if (siteMatch) {
    if (request.method !== 'GET') return methodNotAllowed();
    const site = await cp.getSiteByPublicId(siteMatch[1]!);
    if (!site) return json(404, { error: 'Site not found.' });
    const auth = await siteAuth(request, env, site);
    if (auth instanceof Response) return auth;
    return json(200, await siteView(env, site));
  }

  const proposalsMatch = pathname.match(/^\/api\/biz\/sites\/([a-z0-9]{8})\/proposals$/);
  if (proposalsMatch) {
    if (request.method !== 'POST') return methodNotAllowed();
    const denied = await requireOperator(request, env);
    if (denied) return denied;
    const parsed = await readJson<{ candidate?: SiteData; note?: string }>(request);
    if ('error' in parsed) return parsed.error;
    if (!parsed.value.candidate) return json(400, { error: 'Missing candidate.' });
    const result = await createProposal(
      env,
      proposalsMatch[1]!,
      parsed.value.candidate,
      parsed.value.note,
      'operator',
    );
    return result.ok ? json(200, result.value) : json(result.status, { error: result.error });
  }

  const decisionMatch = pathname.match(
    /^\/api\/biz\/sites\/([a-z0-9]{8})\/proposals\/([a-z0-9]{8})\/(approve|reject)$/,
  );
  if (decisionMatch) {
    if (request.method !== 'POST') return methodNotAllowed();
    const [, siteId, proposalId, decision] = decisionMatch;
    const site = await cp.getSiteByPublicId(siteId!);
    if (!site) return json(404, { error: 'Site not found.' });
    const auth = await siteAuth(request, env, site);
    if (auth instanceof Response) return auth;
    const result = await applyProposalDecision(
      cp,
      site,
      proposalId!,
      decision as 'approve' | 'reject',
      auth.actor,
    );
    if (!result.ok) return json(result.status, { error: result.error });
    return json(200, result.value === null ? { ok: true } : { ok: true, version: result.value });
  }

  const rollbackMatch = pathname.match(/^\/api\/biz\/sites\/([a-z0-9]{8})\/rollback$/);
  if (rollbackMatch) {
    if (request.method !== 'POST') return methodNotAllowed();
    const siteId = rollbackMatch[1]!;
    const site = await cp.getSiteByPublicId(siteId);
    if (!site) return json(404, { error: 'Site not found.' });
    const auth = await siteAuth(request, env, site);
    if (auth instanceof Response) return auth;
    const parsed = await readJson<{ to?: number }>(request);
    if ('error' in parsed) return parsed.error;
    if (!Number.isInteger(parsed.value.to)) return json(400, { error: 'Invalid version.' });
    const result = await rollbackSiteVersion(cp, site, parsed.value.to!, auth.actor);
    return result.ok
      ? json(200, { ok: true, version: result.value })
      : json(result.status, { error: result.error });
  }

  const publishMatch = pathname.match(/^\/api\/biz\/sites\/([a-z0-9]{8})\/(publish|unpublish)$/);
  if (publishMatch) {
    if (request.method !== 'POST') return methodNotAllowed();
    const [, siteId, action] = publishMatch;
    const site = await cp.getSiteByPublicId(siteId!);
    if (!site) return json(404, { error: 'Site not found.' });
    const auth = await siteAuth(request, env, site);
    if (auth instanceof Response) return auth;
    if (action === 'unpublish') {
      await cp.unpublishSite(site, auth.actor);
      return json(200, { ok: true });
    }
    const parsed = await readJson<{ n?: number; override?: boolean; reason?: string }>(request);
    if ('error' in parsed) return parsed.error;
    const n = parsed.value.n ?? site.currentVersion;
    const result = await publishSiteVersion(cp, site, n, auth.actor, {
      requested: parsed.value.override === true,
      reason: parsed.value.reason,
    });
    return result.ok
      ? json(200, { ok: true, version: result.value })
      : json(result.status, { error: result.error });
  }

  const photosMatch = pathname.match(/^\/api\/biz\/sites\/([a-z0-9]{8})\/photos$/);
  if (photosMatch) {
    if (request.method !== 'POST') return methodNotAllowed();
    const denied = await requireOperator(request, env);
    if (denied) return denied;
    const site = await cp.getSiteByPublicId(photosMatch[1]!);
    if (!site) return json(404, { error: 'Site not found.' });
    const contentType = photoContentType(request);
    if (!contentType) return json(415, { error: 'Photo must be image/jpeg, image/png, or image/webp.' });
    const declared = Number(request.headers.get('content-length') ?? '0');
    if (declared > MAX_PHOTO_BYTES) return json(413, { error: 'Photo is too large.' });
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength === 0) return json(400, { error: 'Empty photo.' });
    if (bytes.byteLength > MAX_PHOTO_BYTES) return json(413, { error: 'Photo is too large.' });
    const hex = await sha256HexBytes(bytes);
    const r2Key = `photos/${hex}`;
    const existing = await cp.getPhotoMeta(r2Key);
    if (!existing) {
      await env.PHOTOS.put(r2Key, bytes, { httpMetadata: { contentType } });
      await cp.putPhotoMeta({
        r2Key,
        siteId: site.id,
        contentType,
        bytes: bytes.byteLength,
        actor: 'operator',
      });
    }
    return json(200, { path: `/img/${hex}` });
  }

  const imgMatch = pathname.match(/^\/img\/([a-f0-9]{64})$/);
  if (imgMatch) {
    if (request.method !== 'GET') return methodNotAllowed();
    const r2Key = `photos/${imgMatch[1]!}`;
    const meta = await cp.getPhotoMeta(r2Key);
    if (!meta) return new Response('Not found', { status: 404 });
    const object = await env.PHOTOS.get(r2Key);
    if (!object) return new Response('Not found', { status: 404 });
    return new Response(object.body, {
      headers: {
        'content-type': meta.contentType,
        'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
      },
    });
  }

  const commentMatch = pathname.match(
    /^\/p\/([a-z0-9]{8})\/(current|[a-z0-9]{8})\/comments$/,
  );
  if (commentMatch) {
    if (request.method !== 'POST') return methodNotAllowed();
    const [, siteId, rawProposalId] = commentMatch;
    const site = await cp.getSiteByPublicId(siteId!);
    if (!site) return new Response('Not found', { status: 404 });
    const proposalId = rawProposalId === 'current' ? undefined : rawProposalId;
    if (proposalId !== undefined) {
      const proposal = await cp.getProposal(site.id, proposalId!);
      if (!proposal || proposal.status !== 'open') {
        return new Response('Not found', { status: 404 });
      }
    }
    const access = await previewAccess(request, env, cp, site, proposalId);
    if (!access) return new Response('Not found', { status: 404 });
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return new Response('Bad request', { status: 400 });
    }
    const submittedToken = form.get('t');
    if (typeof submittedToken !== 'string' || !constantTimeEqual(submittedToken, access.token)) {
      return new Response('Not found', { status: 404 });
    }
    const rawBody = form.get('body');
    const body = typeof rawBody === 'string' ? rawBody.trim() : '';
    if (body.length < 1 || body.length > 2000) {
      return new Response('Comment must be 1-2000 characters.', { status: 400 });
    }
    const created = await cp.createDraftComment({
      site,
      ...(proposalId === undefined ? {} : { proposalPublicId: proposalId }),
      author: access.viaToken ? 'customer' : 'operator',
      body,
    });
    if (!created) return new Response('Too many comments.', { status: 429 });
    const location = `/p/${siteId}/${rawProposalId}${access.token ? `?t=${encodeURIComponent(access.token)}` : ''}`;
    return new Response(null, { status: 303, headers: { location } });
  }

  const currentPreviewMatch = pathname.match(/^\/p\/([a-z0-9]{8})\/current$/);
  if (currentPreviewMatch) {
    if (request.method !== 'GET') return methodNotAllowed();
    const site = await cp.getSiteByPublicId(currentPreviewMatch[1]!);
    if (!site) return new Response('Not found', { status: 404 });
    const access = await previewAccess(request, env, cp, site);
    if (!access) return new Response('Not found', { status: 404 });
    return bizPageResponse(bizHtml(site.data, true, true, {
      action: previewCommentAction(site.publicId, 'current', access.token),
      token: access.token,
    }));
  }

  const previewMatch = pathname.match(/^\/p\/([a-z0-9]{8})\/([a-z0-9]{8})$/);
  if (previewMatch) {
    if (request.method !== 'GET') return methodNotAllowed();
    const site = await cp.getSiteByPublicId(previewMatch[1]!);
    if (!site) return new Response('Not found', { status: 404 });
    const access = await previewAccess(request, env, cp, site, previewMatch[2]!);
    if (!access) return new Response('Not found', { status: 404 });
    const proposal = await cp.getProposal(site.id, previewMatch[2]!);
    if (!proposal || proposal.status !== 'open') return new Response('Not found', { status: 404 });
    return bizPageResponse(bizHtml(proposal.candidate, true, true, {
      action: previewCommentAction(site.publicId, proposal.publicId, access.token),
      token: access.token,
    }));
  }

  const publicMatch = pathname.match(/^\/b\/([a-z0-9]{8})$/);
  if (publicMatch) {
    if (request.method !== 'GET') return methodNotAllowed();
    const site = await cp.getSiteByPublicId(publicMatch[1]!);
    if (!site) return new Response('Not found', { status: 404 });
    const noindex = env.BIZ_INDEXING_ENABLED !== 'true' || site.status !== 'published';
    let data = site.data;
    if (site.publishedVersion !== undefined) {
      const snapshot = await cp.getSnapshot(site.id, site.publishedVersion);
      if (snapshot) {
        data = snapshot.data;
      } else {
        console.error(
          `published version ${site.publishedVersion} missing for site ${site.publicId}; serving current`,
        );
      }
    }
    // Publishing changes the pointer without changing currentVersion, so the
    // exact published pointer (or "live" current data) is part of the key.
    // noindex is baked into the cached HTML meta, so a BIZ_INDEXING_ENABLED
    // flip must miss the cache too.
    const cacheKey = `bizhtml:${site.publicId}:${site.currentVersion}:${site.publishedVersion ?? 'live'}:${noindex ? 'noindex' : 'index'}`;
    const cached = await env.SITES.get(cacheKey);
    if (cached !== null) return bizPageResponse(cached, noindex);
    const html = bizHtml(data, false, noindex);
    await env.SITES.put(cacheKey, html, { expirationTtl: RENDER_CACHE_TTL });
    return bizPageResponse(html, noindex);
  }

  return json(404, { error: 'Not found.' });
}
