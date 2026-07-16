import { renderSite } from '../engine/render.js';
import type { SiteData } from '../engine/types.js';
import { getTheme } from '../themes/index.js';
import {
  bearerToken,
  constantTimeEqual,
  type Env,
  json,
  readJson,
  secretMatches,
  sha256Hex,
} from './shared.js';
import { validateSiteData } from './validate.js';

export interface BizVersion {
  n: number;
  at: number;
  note?: string;
  data: SiteData;
}

export interface StoredBizSite {
  v: 1;
  data: SiteData;
  versions: BizVersion[];
  approvalKeyHash: string;
  createdAt: number;
}

export interface StoredProposal {
  v: 1;
  siteId: string;
  candidate: SiteData;
  summary: string[];
  status: 'open' | 'approved' | 'rejected';
  at: number;
  note?: string;
}

export interface ProposalInfo {
  proposalId: string;
  previewPath: string;
  summary: string[];
}

type Operation<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const PROPOSAL_TTL = 14 * 24 * 60 * 60;
const PROPOSALS_PER_DAY = 50;

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((byte) => ID_ALPHABET[byte % ID_ALPHABET.length]).join('');
}

async function unusedId(env: Env, prefix: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const id = randomId();
    if (!(await env.SITES.get(`${prefix}${id}`))) return id;
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

export async function getBizSite(env: Env, siteId: string): Promise<StoredBizSite | null> {
  const raw = await env.SITES.get(`biz:${siteId}`);
  return raw ? JSON.parse(raw) as StoredBizSite : null;
}

async function getProposal(env: Env, siteId: string, proposalId: string): Promise<StoredProposal | null> {
  const raw = await env.SITES.get(`bizprop:${siteId}:${proposalId}`);
  if (!raw) return null;
  const proposal = JSON.parse(raw) as StoredProposal;
  return proposal.siteId === siteId ? proposal : null;
}

export async function listOpenProposals(
  env: Env,
  siteId: string,
): Promise<{ proposalId: string; summary: string[]; at: number }[]> {
  const prefix = `bizprop:${siteId}:`;
  const result = await env.SITES.list({ prefix });
  const proposals: { proposalId: string; summary: string[]; at: number }[] = [];
  for (const key of result.keys) {
    const raw = await env.SITES.get(key.name);
    if (!raw) continue;
    const proposal = JSON.parse(raw) as StoredProposal;
    if (proposal.siteId === siteId && proposal.status === 'open') {
      proposals.push({ proposalId: key.name.slice(prefix.length), summary: proposal.summary, at: proposal.at });
    }
  }
  return proposals.sort((a, b) => a.at - b.at || a.proposalId.localeCompare(b.proposalId));
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
  note?: string,
): Promise<Operation<ProposalInfo>> {
  const site = await getBizSite(env, siteId);
  if (!site) return { ok: false, status: 404, error: 'Site not found.' };
  const invalid = validateSiteData(candidate);
  if (invalid) return { ok: false, status: 400, error: invalid };
  if (note !== undefined && (typeof note !== 'string' || note.length > 300)) {
    return { ok: false, status: 400, error: 'bad proposal note' };
  }
  if (!(await proposalRateLimit(env, siteId))) {
    return { ok: false, status: 429, error: 'Too many proposals today.' };
  }
  const proposalId = await unusedId(env, `bizprop:${siteId}:`);
  const summary = summarizeChanges(site.data, candidate);
  const proposal: StoredProposal = {
    v: 1,
    siteId,
    candidate,
    summary,
    status: 'open',
    at: Date.now(),
    ...(note === undefined ? {} : { note }),
  };
  await env.SITES.put(`bizprop:${siteId}:${proposalId}`, JSON.stringify(proposal), {
    expirationTtl: PROPOSAL_TTL,
  });
  return { ok: true, value: { proposalId, previewPath: `/p/${siteId}/${proposalId}`, summary } };
}

async function operatorAuth(request: Request, env: Env): Promise<Response | null> {
  const token = bearerToken(request);
  if (!token) return json(401, { error: 'Authorization required.' });
  if (!env.OPERATOR_KEY || !(await secretMatches(token, await sha256Hex(env.OPERATOR_KEY)))) {
    return json(403, { error: 'Forbidden.' });
  }
  return null;
}

async function siteAuth(request: Request, env: Env, site: StoredBizSite): Promise<Response | null> {
  const token = bearerToken(request);
  if (!token) return json(401, { error: 'Authorization required.' });
  const tokenHash = await sha256Hex(token);
  const operatorHash = await sha256Hex(env.OPERATOR_KEY ?? '');
  const operatorOk = constantTimeEqual(tokenHash, operatorHash);
  const approvalOk = constantTimeEqual(tokenHash, site.approvalKeyHash);
  return operatorOk || approvalOk ? null : json(403, { error: 'Forbidden.' });
}

function methodNotAllowed(): Response {
  return json(405, { error: 'Method not allowed.' });
}

function noindexPage(data: SiteData, draft: boolean): Response {
  const theme = getTheme(data.meta.themeId);
  const rendered = renderSite(data, theme);
  let html = rendered.html
    .replace('<head>', '<head>\n<meta name="robots" content="noindex">')
    .replace('<link rel="stylesheet" href="style.css">', `<style>\n${rendered.css}</style>`);
  if (draft) {
    const banner = '<div style="position:fixed;z-index:9999;top:0;left:0;right:0;padding:.35rem 1rem;text-align:center;background:var(--accent);color:var(--accent-contrast);font:600 .875rem/1.4 sans-serif">Luonnos - esikatselu</div>';
    html = html.replace(/(<body[^>]*>)/, `$1\n${banner}`);
  }
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-robots-tag': 'noindex',
      'cache-control': 'no-store',
    },
  });
}

export async function handleBizRequest(request: Request, env: Env): Promise<Response> {
  const pathname = new URL(request.url).pathname;

  if (pathname === '/api/biz/sites') {
    if (request.method !== 'POST') return methodNotAllowed();
    const denied = await operatorAuth(request, env);
    if (denied) return denied;
    const parsed = await readJson<{ data?: SiteData }>(request);
    if ('error' in parsed) return parsed.error;
    if (!parsed.value.data) return json(400, { error: 'Missing page data.' });
    const invalid = validateSiteData(parsed.value.data);
    if (invalid) return json(400, { error: invalid });
    const id = await unusedId(env, 'biz:');
    const approvalKey = crypto.randomUUID();
    const site: StoredBizSite = {
      v: 1,
      data: parsed.value.data,
      versions: [],
      approvalKeyHash: await sha256Hex(approvalKey),
      createdAt: Date.now(),
    };
    await env.SITES.put(`biz:${id}`, JSON.stringify(site));
    return json(200, { id, approvalKey });
  }

  const siteMatch = pathname.match(/^\/api\/biz\/sites\/([a-z0-9]{8})$/);
  if (siteMatch) {
    if (request.method !== 'GET') return methodNotAllowed();
    const id = siteMatch[1]!;
    const site = await getBizSite(env, id);
    if (!site) return json(404, { error: 'Site not found.' });
    const denied = await siteAuth(request, env, site);
    if (denied) return denied;
    const proposals = await listOpenProposals(env, id);
    return json(200, {
      data: site.data,
      versions: site.versions.map(({ n, at, note }) => ({ n, at, ...(note === undefined ? {} : { note }) })),
      openProposals: proposals.map(({ proposalId }) => proposalId),
    });
  }

  const proposalsMatch = pathname.match(/^\/api\/biz\/sites\/([a-z0-9]{8})\/proposals$/);
  if (proposalsMatch) {
    if (request.method !== 'POST') return methodNotAllowed();
    const denied = await operatorAuth(request, env);
    if (denied) return denied;
    const parsed = await readJson<{ candidate?: SiteData; note?: string }>(request);
    if ('error' in parsed) return parsed.error;
    if (!parsed.value.candidate) return json(400, { error: 'Missing candidate.' });
    const result = await createProposal(env, proposalsMatch[1]!, parsed.value.candidate, parsed.value.note);
    return result.ok ? json(200, result.value) : json(result.status, { error: result.error });
  }

  const decisionMatch = pathname.match(
    /^\/api\/biz\/sites\/([a-z0-9]{8})\/proposals\/([a-z0-9]{8})\/(approve|reject)$/,
  );
  if (decisionMatch) {
    if (request.method !== 'POST') return methodNotAllowed();
    const [, siteId, proposalId, decision] = decisionMatch;
    const site = await getBizSite(env, siteId!);
    if (!site) return json(404, { error: 'Site not found.' });
    const denied = await siteAuth(request, env, site);
    if (denied) return denied;
    const proposal = await getProposal(env, siteId!, proposalId!);
    if (!proposal || proposal.status !== 'open') return json(404, { error: 'Open proposal not found.' });
    if (decision === 'reject') {
      proposal.status = 'rejected';
      await env.SITES.put(`bizprop:${siteId}:${proposalId}`, JSON.stringify(proposal), {
        expirationTtl: PROPOSAL_TTL,
      });
      return json(200, { ok: true });
    }
    const version = Math.max(0, ...site.versions.map(({ n }) => n)) + 1;
    const snapshot: BizVersion = {
      n: version,
      at: Date.now(),
      data: site.data,
      ...(proposal.note === undefined ? {} : { note: proposal.note }),
    };
    site.versions = [snapshot, ...site.versions].slice(0, 20);
    site.data = proposal.candidate;
    proposal.status = 'approved';
    await env.SITES.put(`biz:${siteId}`, JSON.stringify(site));
    await env.SITES.put(`bizprop:${siteId}:${proposalId}`, JSON.stringify(proposal), {
      expirationTtl: PROPOSAL_TTL,
    });
    return json(200, { ok: true, version });
  }

  const rollbackMatch = pathname.match(/^\/api\/biz\/sites\/([a-z0-9]{8})\/rollback$/);
  if (rollbackMatch) {
    if (request.method !== 'POST') return methodNotAllowed();
    const siteId = rollbackMatch[1]!;
    const site = await getBizSite(env, siteId);
    if (!site) return json(404, { error: 'Site not found.' });
    const denied = await siteAuth(request, env, site);
    if (denied) return denied;
    const parsed = await readJson<{ to?: number }>(request);
    if ('error' in parsed) return parsed.error;
    if (!Number.isInteger(parsed.value.to)) return json(400, { error: 'Invalid version.' });
    const target = site.versions.find(({ n }) => n === parsed.value.to);
    if (!target) return json(400, { error: 'Version not found.' });
    const version = Math.max(0, ...site.versions.map(({ n }) => n)) + 1;
    site.versions = [{ n: version, at: Date.now(), data: site.data }, ...site.versions].slice(0, 20);
    site.data = target.data;
    await env.SITES.put(`biz:${siteId}`, JSON.stringify(site));
    return json(200, { ok: true, version });
  }

  const previewMatch = pathname.match(/^\/p\/([a-z0-9]{8})\/([a-z0-9]{8})$/);
  if (previewMatch) {
    if (request.method !== 'GET') return methodNotAllowed();
    const proposal = await getProposal(env, previewMatch[1]!, previewMatch[2]!);
    if (!proposal || proposal.status !== 'open') return new Response('Not found', { status: 404 });
    return noindexPage(proposal.candidate, true);
  }

  const publicMatch = pathname.match(/^\/b\/([a-z0-9]{8})$/);
  if (publicMatch) {
    if (request.method !== 'GET') return methodNotAllowed();
    const site = await getBizSite(env, publicMatch[1]!);
    if (!site) return new Response('Not found', { status: 404 });
    return noindexPage(site.data, false);
  }

  return json(404, { error: 'Not found.' });
}
