import { renderFavicon } from '../engine/favicon.js';
import { effectivePalette, renderSite, resolveFont } from '../engine/render.js';
import { renderLocalBusinessJsonLd } from '../engine/jsonld.js';
import { esc, escAttr } from '../engine/escape.js';
import {
  collectImages,
  FAVICON_PATH,
  type PhotoRef,
  type SiteData,
} from '../engine/types.js';
import { getTheme } from '../themes/index.js';
import {
  type AuditActor,
  type Claim,
  ControlPlane,
  type OpenProposal,
  type Site,
} from './db.js';
import {
  bearerToken,
  bizRenderCacheKey,
  constantTimeEqual,
  type Env,
  json,
  readJson,
  requireOperator,
  unusedId,
  sha256Hex,
} from './shared.js';
import { readSessionCookie, verifySessionCookie } from './session.js';
import { publishGate, publishGateError } from './qa.js';
import {
  createOrderCheckout,
  OpenOrderError,
  paymentProvider,
  paymentPrices,
  unusedOrderId,
} from './payments.js';
import { DOMAIN_RE } from './provisioning.js';
import { advanceProspectToResponded } from './prospect-status.js';
import { validateSiteData } from './validate.js';
import { handleEmailSimulator } from './update-channels.js';
import { buildStoreZip } from './store-zip.js';

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

const PROPOSALS_PER_DAY = 50;
const PANEL_PROPOSALS_PER_DAY = 20;
const RENDER_CACHE_TTL = 7 * 24 * 60 * 60;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const PREVIEW_TOKEN_TTL = 14 * 24 * 60 * 60 * 1000;
const CLAIMS_PER_DAY = 5;
const CLAIM_EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const PHOTO_TYPES = new Map<string, true>([
  ['image/jpeg', true],
  ['image/png', true],
  ['image/webp', true],
]);

const PAGEFORGE_CREDIT = 'Made with <a href="https://pageforge.mtclab.net" rel="noopener">pageforge</a>';

export function randomPreviewToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function unusedSiteId(cp: ControlPlane): Promise<string> {
  return unusedId((id) => cp.getSiteByPublicId(id), 'site');
}

async function unusedProposalId(cp: ControlPlane, siteId: number): Promise<string> {
  return unusedId((id) => cp.getProposal(siteId, id), 'proposal');
}

type OperationError = Extract<Operation<never>, { ok: false }>;

export function siteMutable(site: Site): OperationError | null {
  return site.status === 'archived'
    ? { ok: false, status: 409, error: 'Sivusto on arkistoitu.' }
    : null;
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
  const [snapshots, openProposals] = await Promise.all([
    cp.listSnapshots(site.id),
    cp.listOpenProposals(site.id),
  ]);
  return {
    data: site.data,
    versions: snapshots.map(({ n, at, note }) => ({ n, at, ...(note === undefined ? {} : { note }) })),
    openProposals: openProposals.map(({ proposalId }) => proposalId),
    status: site.status,
    ...(site.publishedVersion === undefined ? {} : { publishedVersion: site.publishedVersion }),
  };
}

/** Open proposal metadata for the MCP list_proposals tool. */
export async function listOpenProposals(env: Env, site: Site): Promise<OpenProposal[]> {
  return new ControlPlane(env.DB).listOpenProposals(site.id);
}

async function proposalRateLimit(env: Env, siteId: string, panel: boolean): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  const key = `${panel ? 'bizrl-panel' : 'bizrl'}:${siteId}:${day}`;
  const count = Number((await env.SITES.get(key)) ?? '0');
  if (count >= (panel ? PANEL_PROPOSALS_PER_DAY : PROPOSALS_PER_DAY)) return false;
  await env.SITES.put(key, String(count + 1), { expirationTtl: 90_000 });
  return true;
}

export async function createProposal(
  env: Env,
  siteId: string,
  candidate: SiteData,
  note: string | undefined,
  actor: AuditActor,
  detail?: Record<string, unknown>,
): Promise<Operation<ProposalInfo>> {
  const cp = new ControlPlane(env.DB);
  const site = await cp.getSiteByPublicId(siteId);
  if (!site) return { ok: false, status: 404, error: 'Site not found.' };
  const immutable = siteMutable(site);
  if (immutable) return immutable;
  const invalid = validateSiteData(candidate, { allowR2Photos: true });
  if (invalid) return { ok: false, status: 400, error: invalid };
  if (note !== undefined && (typeof note !== 'string' || note.length > 300)) {
    return { ok: false, status: 400, error: 'bad proposal note' };
  }
  if (!(await proposalRateLimit(env, siteId, detail?.channel === 'panel'))) {
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
    ...(detail === undefined ? {} : { detail }),
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

/**
 * The data the published pointer refers to. Snapshot n holds the content OF
 * version n and the current version has no snapshot row, so pointer ===
 * currentVersion means "serve live data"; a genuinely dangling pointer falls
 * back to current with a log line.
 */
export async function publishedSiteData(cp: ControlPlane, site: Site): Promise<SiteData> {
  if (site.publishedVersion === undefined || site.publishedVersion === site.currentVersion) {
    return site.data;
  }
  const snapshot = await cp.getSnapshot(site.id, site.publishedVersion);
  if (snapshot) return snapshot.data;
  console.error(
    `published version ${site.publishedVersion} missing for site ${site.publicId}; serving current`,
  );
  return site.data;
}

/** Shared proposal decision used by both the JSON API and operator console. */
export async function applyProposalDecision(
  cp: ControlPlane,
  site: Site,
  proposalId: string,
  decision: 'approve' | 'reject',
  actor: Extract<AuditActor, 'operator' | 'approval-key'>,
): Promise<Operation<number | null>> {
  const immutable = siteMutable(site);
  if (immutable) return immutable;
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
  const immutable = siteMutable(site);
  if (immutable) return immutable;
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
  const immutable = siteMutable(site);
  if (immutable) return immutable;
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
    const gate = await publishGate(cp, site, n);
    if (!gate.passed) return { ok: false, status: 409, error: publishGateError(gate) };
    if (actor === 'approval-key' && !(await cp.siteIsEntitled(site.id))) {
      return { ok: false, status: 409, error: 'Tilaus ei ole maksettu.' };
    }
  }
  await cp.publishSiteVersion(site, n, actor, overrideReason);
  return { ok: true, value: n };
}

type SiteAuth = { actor: Extract<AuditActor, 'operator' | 'approval-key'> };

async function siteAuth(
  request: Request,
  env: Env,
  site: Site,
  allowSession = false,
): Promise<SiteAuth | Response> {
  const token = bearerToken(request);
  if (token) {
    const tokenHash = await sha256Hex(token);
    const operatorHash = await sha256Hex(env.OPERATOR_KEY ?? '');
    if (constantTimeEqual(tokenHash, operatorHash)) return { actor: 'operator' };
    if (constantTimeEqual(tokenHash, site.approvalKeyHash)) return { actor: 'approval-key' };
  }
  if (allowSession) {
    const session = await verifySessionCookie(readSessionCookie(request), env.OPERATOR_KEY ?? '');
    if (session !== null) return { actor: 'operator' };
  }
  return json(token ? 403 : 401, {
    error: token ? 'Forbidden.' : 'Authorization required.',
  });
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
  suppressBranding = false,
  claim?: { siteId: string; token: string },
): string {
  const theme = getTheme(data.meta.themeId);
  const rendered = renderSite(data, theme, { heroCta: true, bizHero: true });
  let html = rendered.html
    .replace('<link rel="stylesheet" href="style.css">', `<style>\n${rendered.css}</style>`);
  if (noindex) {
    html = html.replace('<head>', '<head>\n<meta name="robots" content="noindex">');
  }
  const jsonLd = renderLocalBusinessJsonLd(data);
  if (jsonLd) html = html.replace('</head>', `${jsonLd}\n</head>`);
  // Business pages carry the service credit instead of the engine's own:
  // published and previews alike show "Sivut: Mikoshi" (unless the paid
  // hideBranding option is on); exports (suppressBranding) carry neither.
  const credit = suppressBranding || data.meta.hideBranding === true ? '' : 'Sivut: Mikoshi';
  html = html.replace(PAGEFORGE_CREDIT, credit);
  html = html.replace('<footer>\n<p></p>\n</footer>', '');
  if (draft) {
    const banner = '<div style="position:fixed;z-index:9999;top:0;left:0;right:0;padding:.35rem 1rem;text-align:center;background:var(--accent);color:var(--accent-contrast);font:600 .875rem/1.4 sans-serif">Luonnos - esikatselu</div>';
    const claimBlock = claim === undefined ? '' : `<aside style="position:relative;z-index:9998;margin:2.5rem auto 1rem;max-width:44rem;padding:1rem;text-align:center;background:#fff;color:#111;border:2px solid var(--accent);font:400 1rem/1.4 sans-serif"><a href="/claim/${escAttr(claim.siteId)}${claim.token ? `?t=${escAttr(encodeURIComponent(claim.token))}` : ''}" style="display:inline-block;padding:.75rem 1rem;border-radius:.35rem;background:var(--accent);color:var(--accent-contrast);font-weight:700;text-decoration:none">Ota tämä sivu käyttöön - 249 € + 19 €/kk</a><p style="margin:.65rem 0 0">Katso ensin, maksa vasta sitten.</p></aside>`;
    const feedback = comment === undefined ? '' : `<form action="${escAttr(comment.action)}" method="post" style="position:relative;z-index:9998;margin:${claim === undefined ? '2.5rem' : '1rem'} auto 1rem;max-width:40rem;padding:1rem;background:#fff;color:#111;border:1px solid #bbb;font:400 1rem/1.4 sans-serif"><input type="hidden" name="t" value="${escAttr(comment.token)}"><label style="display:grid;gap:.4rem;font-weight:600">Kommentti<textarea name="body" required maxlength="2000" style="min-height:6rem;padding:.5rem"></textarea></label><button type="submit" style="margin-top:.6rem;padding:.45rem .8rem">Lähetä kommentti</button></form>`;
    html = html.replace(/(<body[^>]*>)/, `$1\n${banner}${claimBlock}${feedback}`);
  }
  return html;
}

const EXPORT_CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function dataUrlBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function exportFiles(
  env: Env,
  cp: ControlPlane,
  source: SiteData,
): Promise<Record<string, Uint8Array>> {
  const data = JSON.parse(JSON.stringify(source)) as SiteData;
  const files: Record<string, Uint8Array> = {};

  const resolvePhoto = async (photo: PhotoRef): Promise<PhotoRef> => {
    if ('dataUrl' in photo) return photo;
    const match = photo.src.match(/^\/img\/([a-f0-9]{64})$/);
    if (!match) throw new Error(`invalid R2 photo reference in export: ${photo.src}`);
    const r2Key = `photos/${match[1]!}`;
    const meta = await cp.getPhotoMeta(r2Key);
    if (!meta) throw new Error(`photo metadata missing for export: ${r2Key}`);
    const extension = EXPORT_CONTENT_TYPES[meta.contentType];
    if (!extension) throw new Error(`unsupported stored photo type: ${meta.contentType}`);
    const path = `assets/${match[1]!}.${extension}`;
    if (files[path] === undefined) {
      const object = await env.PHOTOS.get(r2Key);
      if (!object) throw new Error(`photo object missing for export: ${r2Key}`);
      files[path] = new Uint8Array(await object.arrayBuffer());
    }
    return { src: path };
  };

  if (data.photo) data.photo = await resolvePhoto(data.photo);
  for (const section of data.sections) {
    if (section.kind === 'gallery') section.photos = await Promise.all(section.photos.map(resolvePhoto));
  }
  for (const [path, dataUrl] of collectImages(data)) files[path] = dataUrlBytes(dataUrl);

  const theme = getTheme(data.meta.themeId);
  if (!data.favicon) {
    files[FAVICON_PATH] = new TextEncoder().encode(renderFavicon(
      data.name,
      effectivePalette(data, theme),
      resolveFont(theme, data.meta.fontId),
    ));
  }
  const encoder = new TextEncoder();
  files['index.html'] = encoder.encode(bizHtml(data, false, false, undefined, true));
  files['site.json'] = encoder.encode(`${JSON.stringify(data, null, 2)}\n`);
  files['LUEMINUT.txt'] = encoder.encode(
    `SIVUSTON LUOVUTUSPAKETTI\n\n`+
    `index.html on valmis verkkosivu. site.json sisältää sivuston rakenteiset tiedot, `+
    `ja assets-kansiossa ovat sivun kuvat.\n\n`+
    `Voit julkaista sivun millä tahansa tavallisia HTML-tiedostoja palvelevalla webhotellilla: `+
    `pura ZIP ja siirrä index.html, site.json, LUEMINUT.txt ja assets-kansio samaan hakemistoon.\n`,
  );
  return files;
}

type PreviewAccess = { viaToken: boolean; token: string };

async function previewAccess(
  request: Request,
  env: Env,
  cp: ControlPlane,
  site: Site,
  proposalPublicId?: string,
  allowAnyProposal = false,
): Promise<PreviewAccess | null> {
  const token = new URL(request.url).searchParams.get('t') ?? '';
  if (token) {
    const record = await cp.findPreviewToken(await sha256Hex(token));
    if (
      record
      && record.siteId === site.id
      && record.revokedAt === undefined
      && record.expiresAt > Date.now()
      && (allowAnyProposal
        || record.proposalPublicId === undefined
        || record.proposalPublicId === proposalPublicId)
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

function photoContentType(request: Request): string | null {
  const raw = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
  return PHOTO_TYPES.has(raw) ? raw : null;
}

/** Shared operator photo pipeline for the raw API and multipart console form. */
export async function storeSitePhoto(
  env: Env,
  cp: ControlPlane,
  site: Site,
  bytes: ArrayBuffer,
  rawContentType: string,
): Promise<Operation<string>> {
  const immutable = siteMutable(site);
  if (immutable) return immutable;
  const contentType = rawContentType.trim().toLowerCase();
  if (!PHOTO_TYPES.has(contentType)) {
    return { ok: false, status: 415, error: 'Photo must be image/jpeg, image/png, or image/webp.' };
  }
  if (bytes.byteLength === 0) return { ok: false, status: 400, error: 'Empty photo.' };
  if (bytes.byteLength > MAX_PHOTO_BYTES) {
    return { ok: false, status: 413, error: 'Photo is too large.' };
  }
  const hex = await sha256Hex(bytes);
  const r2Key = `photos/${hex}`;
  if (!(await env.PHOTOS.head(r2Key))) {
    await env.PHOTOS.put(r2Key, bytes, { httpMetadata: { contentType } });
  }
  await cp.putPhotoMeta({
    r2Key,
    siteId: site.id,
    contentType,
    bytes: bytes.byteLength,
    actor: 'operator',
  });
  return { ok: true, value: `/img/${hex}` };
}

interface ClaimFormValues {
  name: string;
  email: string;
  phone: string;
  domainWish: string;
  message: string;
}

const EMPTY_CLAIM_FORM: ClaimFormValues = {
  name: '',
  email: '',
  phone: '',
  domainWish: '',
  message: '',
};

export function claimPage(title: string, body: string): Response {
  return new Response(`<!doctype html>
<html lang="fi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>:root{font-family:system-ui,sans-serif;line-height:1.5;color:#172033;background:#f5f7fa}body{margin:0}main{max-width:42rem;margin:2rem auto;padding:1.25rem}.card,section{padding:1.25rem;border:1px solid #d8dee8;border-radius:.6rem;background:#fff}form{display:grid;gap:.9rem}label{display:grid;gap:.3rem;font-weight:650}input,textarea,button{box-sizing:border-box;width:100%;padding:.65rem;font:inherit}textarea{min-height:7rem}button{border:0;border-radius:.35rem;background:#174ea6;color:#fff;font-weight:700;cursor:pointer}.price{font-size:1.35rem;font-weight:750;margin-bottom:.2rem}.notice{padding:.75rem;background:#fff1d6;border:1px solid #e1b85b}.error{background:#fde8e8;border-color:#d78888;color:#791f1f}.small{font-size:.9rem;color:#5d6878}</style></head><body><main>${body}</main></body></html>`, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
    },
  });
}

function claimFormPage(
  site: Site,
  token: string,
  prices: { buildCents: number; monthlyCents: number },
  mock: boolean,
  values: ClaimFormValues = EMPTY_CLAIM_FORM,
  error?: string,
): Response {
  const price = `${prices.buildCents / 100} € + ${prices.monthlyCents / 100} €/kk`;
  const action = `/claim/${site.publicId}${token ? `?t=${encodeURIComponent(token)}` : ''}`;
  const preview = `/p/${site.publicId}/current${token ? `?t=${encodeURIComponent(token)}` : ''}`;
  const errorHtml = error === undefined
    ? ''
    : `<p class="notice error" role="alert">${esc(error)}</p>`;
  return claimPage(
    `Ota ${site.data.name} käyttöön`,
    `<section><h1>Ota ${esc(site.data.name)} käyttöön</h1><p class="price">${esc(price)}</p><p>249 € kertamaksu + 19 €/kk ylläpito. Ei määräaikaista sitoutumista.</p>
    <h2>Mitä saat</h2><ul><li>oma verkkotunnus (esim. yritys.fi)</li><li>sähköpostien ohjaus</li><li>nopeat ja turvalliset sivut</li><li>pienet päivitykset kuukausittain</li><li>sivut saa aina mukaansa (ZIP)</li></ul>
    <p><a href="${escAttr(preview)}">Katso sivusi vielä kerran</a></p>${errorHtml}
    <form action="${escAttr(action)}" method="post"><input type="hidden" name="t" value="${escAttr(token)}">
      <label>Nimi *<input name="name" required maxlength="200" autocomplete="name" value="${escAttr(values.name)}"></label>
      <label>Sähköposti *<input name="email" type="email" required maxlength="322" autocomplete="email" value="${escAttr(values.email)}"></label>
      <label>Puhelin<input name="phone" type="tel" maxlength="100" autocomplete="tel" value="${escAttr(values.phone)}"></label>
      <label>Toivottu verkkotunnus<input name="domain_wish" maxlength="72" pattern="${escAttr(DOMAIN_RE.source)}" placeholder="yritys.fi" value="${escAttr(values.domainWish)}"></label>
      <label>Viesti<textarea name="message" maxlength="2000">${esc(values.message)}</textarea></label>
      <button type="submit">Siirry maksamaan</button>
    </form>${mock ? '<p class="small">Testiympäristö: maksua ei veloiteta.</p>' : ''}</section>`,
  );
}

function claimReservedPage(site: Site): Response {
  return claimPage(
    'Sivu on jo varattu',
    `<section><h1>${esc(site.data.name)}</h1><p class="notice">Tämä sivu on jo varattu / tilattu.</p></section>`,
  );
}

function claimFormValues(form: FormData): ClaimFormValues {
  const value = (name: string): string => {
    const entry = form.get(name);
    return typeof entry === 'string' ? entry.trim() : '';
  };
  return {
    name: value('name'),
    email: value('email'),
    phone: value('phone'),
    domainWish: value('domain_wish'),
    message: value('message'),
  };
}

function validateClaimForm(values: ClaimFormValues): string | null {
  if (!values.name || values.name.length > 200) return 'Nimen pitää olla 1–200 merkkiä.';
  if (values.email.length > 322 || !CLAIM_EMAIL_RE.test(values.email)) {
    return 'Anna kelvollinen sähköpostiosoite.';
  }
  if (values.phone.length > 100) return 'Puhelinnumero on liian pitkä.';
  if (values.domainWish && !DOMAIN_RE.test(values.domainWish)) {
    return 'Virheellinen verkkotunnus.';
  }
  if (values.message.length > 2000) return 'Viesti on liian pitkä.';
  return null;
}

async function claimRateLimit(env: Env, siteId: string): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  const key = `claimrl:${siteId}:${day}`;
  const count = Number((await env.SITES.get(key)) ?? '0');
  if (count >= CLAIMS_PER_DAY) return false;
  await env.SITES.put(key, String(count + 1), { expirationTtl: 90_000 });
  return true;
}

export async function handleBizRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const cp = new ControlPlane(env.DB);

  const claimMatch = pathname.match(/^\/claim\/([a-z0-9]{8})$/);
  if (claimMatch) {
    if (request.method !== 'GET' && request.method !== 'POST') return methodNotAllowed();
    const site = await cp.getSiteByPublicId(claimMatch[1]!);
    if (!site) return new Response('Not found', { status: 404 });
    const access = await previewAccess(request, env, cp, site, undefined, true);
    if (!access) return new Response('Not found', { status: 404 });
    if (request.method === 'GET') {
      return (await cp.siteClaimEligible(site))
        ? claimFormPage(site, access.token, paymentPrices(env), paymentProvider(env).name === 'mock')
        : claimReservedPage(site);
    }

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
    const immutable = siteMutable(site);
    if (immutable || !(await cp.siteClaimEligible(site))) {
      const response = claimReservedPage(site);
      return new Response(response.body, { status: 409, headers: response.headers });
    }
    const values = claimFormValues(form);
    const invalid = validateClaimForm(values);
    if (invalid) {
      const response = claimFormPage(site, access.token, paymentPrices(env), paymentProvider(env).name === 'mock', values, invalid);
      return new Response(response.body, { status: 400, headers: response.headers });
    }
    if (!(await claimRateLimit(env, site.publicId))) {
      const response = claimFormPage(
        site,
        access.token,
        paymentPrices(env),
        paymentProvider(env).name === 'mock',
        values,
        'Liian monta yritystä tänään. Yritä huomenna uudelleen.',
      );
      return new Response(response.body, { status: 429, headers: response.headers });
    }

    let claim: Claim;
    try {
      claim = await cp.createClaim({
        site,
        name: values.name,
        email: values.email,
        ...(values.phone ? { phone: values.phone } : {}),
        ...(values.domainWish ? { domainWish: values.domainWish } : {}),
        ...(values.message ? { message: values.message } : {}),
      });
    } catch (error) {
      if (!(await cp.siteClaimEligible(site))) {
        const response = claimReservedPage(site);
        return new Response(response.body, { status: 409, headers: response.headers });
      }
      throw error;
    }
    if (site.prospectId !== undefined) {
      const prospect = await cp.getProspectById(site.prospectId);
      if (prospect) await advanceProspectToResponded(cp, prospect);
    }
    try {
      const checkout = await createOrderCheckout(
        cp,
        env,
        site,
        url.origin,
        await unusedOrderId(cp),
        'system',
        { channel: 'claim' },
      );
      await cp.linkClaimOrder(claim, checkout.order);
      return new Response(null, { status: 303, headers: { location: checkout.redirectUrl } });
    } catch (error) {
      if (error instanceof OpenOrderError) {
        const response = claimReservedPage(site);
        return new Response(response.body, { status: 409, headers: response.headers });
      }
      throw error;
    }
  }

  if (pathname === '/api/biz/email-ingress') return handleEmailSimulator(request, env);

  if (pathname === '/api/biz/sites') {
    if (request.method !== 'POST') return methodNotAllowed();
    const denied = await requireOperator(request, env);
    if (denied) return denied;
    const parsed = await readJson<{ data?: SiteData }>(request);
    if ('error' in parsed) return parsed.error;
    if (!parsed.value.data) return json(400, { error: 'Missing page data.' });
    const invalid = validateSiteData(parsed.value.data, { allowR2Photos: true });
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

  const exportMatch = pathname.match(/^\/api\/biz\/sites\/([a-z0-9]{8})\/export$/);
  if (exportMatch) {
    if (request.method !== 'GET') return methodNotAllowed();
    const site = await cp.getSiteByPublicId(exportMatch[1]!);
    if (!site) return json(404, { error: 'Site not found.' });
    const auth = await siteAuth(request, env, site, true);
    if (auth instanceof Response) return auth;
    const data = await publishedSiteData(cp, site);
    const zip = buildStoreZip(await exportFiles(env, cp, data));
    await cp.recordAudit({
      actor: auth.actor,
      action: 'site.export',
      entity: 'site',
      entityId: site.publicId,
    });
    const body = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
    return new Response(body, {
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="${site.publicId}-export.zip"`,
        'cache-control': 'no-store',
      },
    });
  }

  const provisioningMatch = pathname.match(/^\/api\/biz\/sites\/([a-z0-9]{8})\/provisioning$/);
  if (provisioningMatch) {
    if (request.method !== 'GET') return methodNotAllowed();
    const denied = await requireOperator(request, env);
    if (denied) return denied;
    const site = await cp.getSiteByPublicId(provisioningMatch[1]!);
    if (!site) return json(404, { error: 'Site not found.' });
    const [run, renewals] = await Promise.all([
      cp.latestProvisioningRunForSite(site.id),
      cp.listRenewalsForSite(site.id),
    ]);
    const steps = run === null ? [] : await cp.listProvisioningSteps(run.id);
    return json(200, { run, steps, renewals });
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

  const orderMatch = pathname.match(/^\/api\/biz\/sites\/([a-z0-9]{8})\/order$/);
  if (orderMatch) {
    if (request.method !== 'POST') return methodNotAllowed();
    const site = await cp.getSiteByPublicId(orderMatch[1]!);
    if (!site) return json(404, { error: 'Site not found.' });
    const auth = await siteAuth(request, env, site);
    if (auth instanceof Response) return auth;
    const immutable = siteMutable(site);
    if (immutable) return json(immutable.status, { error: immutable.error });
    try {
      const checkout = await createOrderCheckout(
        cp,
        env,
        site,
        url.origin,
        await unusedOrderId(cp),
        auth.actor,
      );
      return json(200, { orderId: checkout.order.publicId, redirectUrl: checkout.redirectUrl });
    } catch (error) {
      if (error instanceof OpenOrderError) return json(409, { error: 'Site already has an open order.' });
      throw error;
    }
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
      const immutable = siteMutable(site);
      if (immutable) return json(immutable.status, { error: immutable.error });
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
    const stored = await storeSitePhoto(env, cp, site, bytes, contentType);
    return stored.ok ? json(200, { path: stored.value }) : json(stored.status, { error: stored.error });
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
    const claim = await cp.siteClaimEligible(site)
      ? { siteId: site.publicId, token: access.token }
      : undefined;
    return bizPageResponse(bizHtml(site.data, true, true, {
      action: previewCommentAction(site.publicId, 'current', access.token),
      token: access.token,
    }, false, claim));
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
    const claim = await cp.siteClaimEligible(site)
      ? { siteId: site.publicId, token: access.token }
      : undefined;
    return bizPageResponse(bizHtml(proposal.candidate, true, true, {
      action: previewCommentAction(site.publicId, proposal.publicId, access.token),
      token: access.token,
    }, false, claim));
  }

  const publicMatch = pathname.match(/^\/b\/([a-z0-9]{8})$/);
  if (publicMatch) {
    if (request.method !== 'GET') return methodNotAllowed();
    const site = await cp.getSiteByPublicId(publicMatch[1]!);
    if (!site || site.status !== 'published') return new Response('Not found', { status: 404 });
    const noindex = env.BIZ_INDEXING_ENABLED !== 'true';
    // Publishing changes the pointer without changing currentVersion, so the
    // exact published pointer (or "live" current data) is part of the key.
    // noindex is baked into the cached HTML meta, so a BIZ_INDEXING_ENABLED
    // flip must miss the cache too.
    const cacheKey = bizRenderCacheKey(site, noindex, env.BUILD_COMMIT ?? 'dev');
    const cached = await env.SITES.get(cacheKey);
    if (cached !== null) return bizPageResponse(cached, noindex);
    const data = await publishedSiteData(cp, site);
    const html = bizHtml(data, false, noindex);
    await env.SITES.put(cacheKey, html, { expirationTtl: RENDER_CACHE_TTL });
    return bizPageResponse(html, noindex);
  }

  return json(404, { error: 'Not found.' });
}
