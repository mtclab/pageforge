import { esc, escAttr } from '../engine/escape.js';
import type { Section, SiteData } from '../engine/types.js';
import { createProposal } from './biz.js';
import { BUSINESS_PROFILE_LIMITS } from './business-profile.js';
import { ControlPlane, type Site } from './db.js';
import { constantTimeEqual, type Env, sha256Hex } from './shared.js';

type PanelKind = 'hours' | 'services' | 'notice';

const PANEL_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex',
};

function response(content: string, status = 200): Response {
  return new Response(`<!doctype html><html lang="fi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Päivitä sivustoa · Mikoshi</title><style>:root{font-family:system-ui,sans-serif;line-height:1.5;color:#1b2430;background:#f5f7fa}*{box-sizing:border-box}main{max-width:60rem;margin:auto;padding:2rem 1rem}section{background:#fff;border:1px solid #d8dee8;border-radius:.5rem;padding:1rem;margin:1rem 0}label{display:grid;gap:.25rem;font-weight:600;margin:.7rem 0}input,textarea,button{font:inherit;padding:.5rem}input,textarea{width:100%}textarea{min-height:6rem}table{width:100%;border-collapse:collapse}th,td{padding:.45rem;border:1px solid #d8dee8;text-align:left}button{background:#174ea6;color:#fff;border:0;border-radius:.3rem}.notice{padding:.8rem;background:#fff1d6;border:1px solid #e1b85b;border-radius:.4rem}.error{background:#fde8e8;border-color:#d78888}a{color:#174ea6}@media(max-width:42rem){.table-wrap{overflow-x:auto}}</style></head><body><main>${content}</main></body></html>`, {
    status,
    headers: PANEL_HEADERS,
  });
}

function notFound(): Response {
  return new Response('Not found', { status: 404 });
}

export function panelCapabilities(data: SiteData): Set<PanelKind> {
  const permitted = new Set<PanelKind>();
  for (const kind of ['hours', 'services', 'notice'] as const) {
    if (data.capabilities?.[kind] === true || data.sections.some((section) => section.kind === kind)) {
      permitted.add(kind);
    }
  }
  return permitted;
}

function firstSection<K extends PanelKind>(
  data: SiteData,
  kind: K,
): Extract<Section, { kind: K }> | undefined {
  return data.sections.find((section): section is Extract<Section, { kind: K }> => section.kind === kind);
}

function panelForm(site: Site, token: string, error?: string): string {
  const permitted = panelCapabilities(site.data);
  const hours = firstSection(site.data, 'hours');
  const services = firstSection(site.data, 'services');
  const notice = firstSection(site.data, 'notice');
  const hourRows = Array.from({ length: BUSINESS_PROFILE_LIMITS.hours }, (_, index) => {
    const row = hours?.days[index];
    return `<tr><td><input aria-label="Päivä ${index + 1}" name="hours_${index}_label" value="${escAttr(row?.label ?? '')}"></td><td><input aria-label="Aukeaa ${index + 1}" name="hours_${index}_open" value="${escAttr(row?.open ?? '')}" placeholder="09:00"></td><td><input aria-label="Sulkeutuu ${index + 1}" name="hours_${index}_close" value="${escAttr(row?.close ?? '')}" placeholder="17:00"></td><td><input aria-label="Suljettu ${index + 1}" name="hours_${index}_closed" type="checkbox"${row?.closed ? ' checked' : ''}></td></tr>`;
  }).join('');
  const serviceRows = Array.from({ length: BUSINESS_PROFILE_LIMITS.services }, (_, index) => {
    const item = services?.items[index];
    return `<tr><td><input aria-label="Palvelun nimi ${index + 1}" name="services_${index}_name" value="${escAttr(item?.name ?? '')}"></td><td><input aria-label="Palvelun hinta ${index + 1}" name="services_${index}_price" value="${escAttr(item?.price ?? '')}" placeholder="35 €"></td></tr>`;
  }).join('');
  const sections = [
    permitted.has('hours') ? `<section><h2>Aukioloajat</h2><div class="table-wrap"><table><thead><tr><th>Päivä</th><th>Aukeaa</th><th>Sulkeutuu</th><th>Suljettu</th></tr></thead><tbody>${hourRows}</tbody></table></div></section>` : '',
    permitted.has('notice') ? `<section><h2>Tiedote</h2><label>Otsikko<input name="notice_title" value="${escAttr(notice?.title ?? '')}"></label><label>Teksti<textarea name="notice_text">${esc(notice?.text ?? '')}</textarea></label><label>Voimassa asti<input name="notice_until" type="date" value="${escAttr(notice?.until ?? '')}"></label></section>` : '',
    permitted.has('services') ? `<section><h2>Palvelut</h2><div class="table-wrap"><table><thead><tr><th>Nimi</th><th>Hinta</th></tr></thead><tbody>${serviceRows}</tbody></table></div></section>` : '',
  ].join('');
  const message = error === undefined ? '' : `<p class="notice error" role="alert">${esc(error)}</p>`;
  return `<h1>Päivitä sivuston tietoja</h1><p>${esc(site.data.name)}</p>${message}<form action="/panel?t=${escAttr(encodeURIComponent(token))}" method="post"><input type="hidden" name="t" value="${escAttr(token)}">${sections}<button type="submit">Lähetä ehdotus</button></form>`;
}

function formValue(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function replaceSection(data: SiteData, kind: PanelKind, replacement: Section): SiteData {
  const index = data.sections.findIndex((section) => section.kind === kind);
  const sections = data.sections.filter((section) => section.kind !== kind);
  sections.splice(index < 0 ? sections.length : index, 0, replacement);
  return { ...data, sections };
}

export function panelCandidate(current: SiteData, form: FormData): SiteData {
  const permitted = panelCapabilities(current);
  let candidate: SiteData = { ...current, sections: [...current.sections] };
  if (permitted.has('hours')) {
    const existing = firstSection(current, 'hours');
    const days: Extract<Section, { kind: 'hours' }>['days'] = [];
    for (let index = 0; index < BUSINESS_PROFILE_LIMITS.hours; index++) {
      const label = formValue(form, `hours_${index}_label`);
      const open = formValue(form, `hours_${index}_open`);
      const close = formValue(form, `hours_${index}_close`);
      const closed = form.get(`hours_${index}_closed`) !== null;
      if (!label && !open && !close && !closed) continue;
      days.push({
        label,
        ...(open ? { open } : {}),
        ...(close ? { close } : {}),
        ...(closed ? { closed: true } : {}),
      });
    }
    candidate = replaceSection(candidate, 'hours', {
      kind: 'hours',
      ...(existing?.title === undefined ? {} : { title: existing.title }),
      days,
      ...(existing?.exceptions === undefined ? {} : { exceptions: existing.exceptions }),
    });
  }
  if (permitted.has('notice')) {
    const title = formValue(form, 'notice_title');
    const text = formValue(form, 'notice_text');
    const until = formValue(form, 'notice_until');
    candidate = replaceSection(candidate, 'notice', {
      kind: 'notice',
      ...(title ? { title } : {}),
      text,
      ...(until ? { until } : {}),
    });
  }
  if (permitted.has('services')) {
    const existing = firstSection(current, 'services');
    const items: Extract<Section, { kind: 'services' }>['items'] = [];
    for (let index = 0; index < BUSINESS_PROFILE_LIMITS.services; index++) {
      const name = formValue(form, `services_${index}_name`);
      const price = formValue(form, `services_${index}_price`);
      if (!name && !price) continue;
      items.push({ name, ...(price ? { price } : {}) });
    }
    candidate = replaceSection(candidate, 'services', {
      kind: 'services',
      ...(existing?.title === undefined ? {} : { title: existing.title }),
      items,
    });
  }
  return candidate;
}

async function access(request: Request, cp: ControlPlane): Promise<{ site: Site; token: string } | null> {
  const token = new URL(request.url).searchParams.get('t');
  if (!token) return null;
  const record = await cp.findPanelToken(await sha256Hex(token));
  if (!record || record.revokedAt !== undefined || record.expiresAt <= Date.now()) return null;
  const site = await cp.getSiteById(record.siteId);
  return site ? { site, token } : null;
}

export async function handlePanelRequest(request: Request, env: Env): Promise<Response> {
  const cp = new ControlPlane(env.DB);
  const authorized = await access(request, cp);
  if (!authorized) return notFound();
  const { site, token } = authorized;
  if (request.method === 'GET') return response(panelForm(site, token));
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return response(panelForm(site, token, 'Pyyntöä ei voitu lukea.'), 400);
  }
  if (!constantTimeEqual(formValue(form, 't'), token)) return notFound();
  const candidate = panelCandidate(site.data, form);
  const proposal = await createProposal(
    env,
    site.publicId,
    candidate,
    undefined,
    'approval-key',
    { channel: 'panel' },
  );
  if (!proposal.ok) return response(panelForm(site, token, proposal.error), proposal.status);
  const permitted = panelCapabilities(site.data);
  const updateRequest = await cp.createUpdateRequest({
    site,
    channel: 'panel',
    body: JSON.stringify({
      sections: candidate.sections.filter((section) =>
        section.kind === 'hours' || section.kind === 'services' || section.kind === 'notice'
          ? permitted.has(section.kind)
          : false),
    }),
    actor: 'approval-key',
  });
  await cp.linkUpdateRequestProposal(updateRequest.id, proposal.value.proposalId, 'approval-key');
  const summary = proposal.value.summary.length
    ? `<ul>${proposal.value.summary.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`
    : '<p>Ei muutoksia nykyisiin tietoihin.</p>';
  return response(`<h1>Kiitos! Ehdotus odottaa vahvistusta.</h1>${summary}<p><a href="${escAttr(proposal.value.previewPath)}">Esikatsele ehdotus</a></p>`);
}
