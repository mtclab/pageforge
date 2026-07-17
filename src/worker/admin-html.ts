import { esc, escAttr } from '../engine/escape.js';
import type {
  AuditEventRecord,
  OpenProposal,
  Prospect,
  ProspectStatus,
  Site,
  SiteListItem,
  SnapshotMeta,
  StatusCounts,
} from './db.js';
import { PROSPECT_STATUSES, SITE_STATUSES } from './db.js';

function formToken(csrf: string): string {
  return `<input type="hidden" name="csrf" value="${escAttr(csrf)}">`;
}

function badge(status: string): string {
  return `<span class="badge">${esc(status)}</span>`;
}

function formatTime(at: number): string {
  const iso = new Date(at).toISOString();
  return `<time datetime="${escAttr(iso)}">${esc(iso.slice(0, 16).replace('T', ' '))} UTC</time>`;
}

function field(label: string, name: string, type = 'text'): string {
  return `<label>${esc(label)}<input name="${escAttr(name)}" type="${escAttr(type)}"></label>`;
}

export function layout(title: string, content: string, csrf?: string): string {
  const navigation = csrf === undefined
    ? '<a class="brand" href="/admin/login">Pageforge</a>'
    : `<a class="brand" href="/admin">Pageforge</a>
       <nav aria-label="Päänavigaatio">
         <a href="/admin">Dashboard</a>
         <a href="/admin/prospects">Prospektit</a>
         <a href="/admin/sites">Sivustot</a>
         <a href="/admin/audit">Loki</a>
         <form action="/admin/logout" method="post">${formToken(csrf)}<button class="link" type="submit">Kirjaudu ulos</button></form>
       </nav>`;
  return `<!doctype html>
<html lang="fi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${esc(title)} · Pageforge</title>
  <style>
    :root{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1b2430;background:#f5f7fa;line-height:1.45}
    *{box-sizing:border-box}body{margin:0}header{background:#fff;border-bottom:1px solid #d8dee8}header>div{max-width:72rem;margin:auto;padding:1rem;display:flex;gap:1.5rem;align-items:center;justify-content:space-between;flex-wrap:wrap}.brand{font-size:1.2rem;font-weight:750;color:#152238;text-decoration:none}nav{display:flex;align-items:center;gap:1rem;flex-wrap:wrap}nav a,.link{color:#174ea6;text-decoration:none;font:inherit}.link{padding:0;border:0;background:none;cursor:pointer}nav form{margin:0}main{max-width:72rem;margin:auto;padding:1.5rem 1rem 3rem}h1{margin-top:0}h2{margin-top:2rem}a{color:#174ea6}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(13rem,1fr));gap:1rem}.card,.column{background:#fff;border:1px solid #d8dee8;border-radius:.5rem;padding:1rem}.card h2,.column h2{margin-top:0}.number{font-size:2rem;font-weight:750}.kanban{display:grid;grid-template-columns:repeat(9,minmax(12rem,1fr));gap:.75rem;overflow-x:auto;padding-bottom:.5rem}.column{padding:.75rem}.column h2{font-size:1rem}.prospect{display:block;border-top:1px solid #e5e9f0;padding:.65rem 0;text-decoration:none}.prospect:first-of-type{border-top:0}.muted{color:#5d6878}.badge{display:inline-block;padding:.12rem .45rem;border-radius:999px;background:#e7eefb;color:#183b6b;font-size:.8rem}table{width:100%;border-collapse:collapse;background:#fff}th,td{padding:.55rem .65rem;border:1px solid #d8dee8;text-align:left;vertical-align:top}th{background:#eef2f7}form.stack{display:grid;gap:.8rem;max-width:40rem}.fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(13rem,1fr));gap:.8rem}label{display:grid;gap:.25rem;font-weight:600}input,select,textarea,button{font:inherit}input,select,textarea{width:100%;padding:.5rem;border:1px solid #aeb8c7;border-radius:.3rem;background:#fff}textarea{min-height:5rem}button,.button{display:inline-block;width:auto;padding:.45rem .7rem;border:1px solid #174ea6;border-radius:.3rem;background:#174ea6;color:#fff;text-decoration:none;cursor:pointer}button.secondary{background:#fff;color:#174ea6}button.danger{border-color:#a12828;background:#a12828}.actions{display:flex;gap:.5rem;align-items:end;flex-wrap:wrap}.actions form{margin:0}.notice{padding:.75rem 1rem;border-radius:.35rem;background:#fff1d6;border:1px solid #e1b85b}.error{background:#fde8e8;border-color:#d78888;color:#791f1f}.filters{display:flex;gap:.5rem;flex-wrap:wrap;margin:1rem 0}.filters a{padding:.3rem .55rem;border:1px solid #bdc7d5;border-radius:.3rem;background:#fff;text-decoration:none}.filters a.active{background:#174ea6;color:#fff;border-color:#174ea6}.summary{margin:.25rem 0;padding-left:1.2rem}.proposal{border-top:1px solid #d8dee8;padding:1rem 0}.proposal:first-of-type{border-top:0}.definition{display:grid;grid-template-columns:max-content 1fr;gap:.4rem 1rem}.definition dt{font-weight:700}.definition dd{margin:0}.nowrap{white-space:nowrap}@media(max-width:45rem){table{font-size:.9rem}.table-wrap{overflow-x:auto}.definition{grid-template-columns:1fr}.definition dd{margin-bottom:.6rem}}
  </style>
</head>
<body>
  <header><div>${navigation}</div></header>
  <main>${content}</main>
</body>
</html>`;
}

export function loginPage(error?: string): string {
  const message = error === undefined ? '' : `<p class="notice error" role="alert">${esc(error)}</p>`;
  return layout('Kirjaudu', `<h1>Operaattorin kirjautuminen</h1>
    ${message}
    <form class="stack" action="/admin/login" method="post">
      <label>Operaattoriavain<input name="key" type="password" required autofocus autocomplete="current-password"></label>
      <div><button type="submit">Kirjaudu</button></div>
    </form>`);
}

function auditTable(events: AuditEventRecord[]): string {
  if (!events.length) return '<p class="muted">Ei tapahtumia.</p>';
  const rows = events.map((event) => {
    const detail = event.detail === undefined ? '' : JSON.stringify(event.detail);
    let entity = `${esc(event.entity)} / ${esc(event.entityId)}`;
    if (event.entity === 'site') {
      entity = `<a href="/admin/sites/${escAttr(event.entityId)}">${entity}</a>`;
    } else if (event.entity === 'prospect') {
      entity = `<a href="/admin/prospects/${escAttr(event.entityId)}">${entity}</a>`;
    }
    return `<tr><td>${esc(String(event.id))}</td><td class="nowrap">${formatTime(event.at)}</td><td>${esc(event.actor)}</td><td>${esc(event.action)}</td><td>${entity}</td><td>${esc(detail)}</td></tr>`;
  }).join('');
  return `<div class="table-wrap"><table><thead><tr><th>ID</th><th>Aika</th><th>Toimija</th><th>Tapahtuma</th><th>Kohde</th><th>Tiedot</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

export function dashboardPage(counts: StatusCounts, events: AuditEventRecord[], csrf: string): string {
  const prospectCards = PROSPECT_STATUSES.map((status) => `<div class="card"><div>${badge(status)}</div><div class="number">${esc(String(counts.prospects[status]))}</div></div>`).join('');
  const siteCards = SITE_STATUSES.map((status) => `<div class="card"><div>${badge(status)}</div><div class="number">${esc(String(counts.sites[status]))}</div></div>`).join('');
  return layout('Dashboard', `<h1>Dashboard</h1>
    <h2>Prospektit</h2><div class="grid">${prospectCards}</div>
    <h2>Sivustot</h2><div class="grid">${siteCards}<div class="card"><div>Avoimet ehdotukset</div><div class="number">${esc(String(counts.openProposals))}</div></div></div>
    <h2>Viimeisimmät tapahtumat</h2>${auditTable(events)}`, csrf);
}

export function prospectsPage(
  prospects: Prospect[],
  csrf: string,
  selected?: ProspectStatus,
  error?: string,
): string {
  const filters = ['<a href="/admin/prospects">Kaikki</a>', ...PROSPECT_STATUSES.map((status) => `<a${selected === status ? ' class="active"' : ''} href="/admin/prospects?status=${escAttr(status)}">${esc(status)}</a>`)].join('');
  const columns = PROSPECT_STATUSES
    .filter((status) => selected === undefined || selected === status)
    .map((status) => {
      const items = prospects.filter((prospect) => prospect.status === status).map((prospect) => `<a class="prospect" href="/admin/prospects/${escAttr(prospect.publicId)}"><strong>${esc(prospect.name)}</strong><br><span class="muted">${esc(prospect.municipality ?? prospect.vertical ?? prospect.publicId)}</span></a>`).join('');
      return `<section class="column"><h2>${esc(status)}</h2>${items || '<p class="muted">Ei prospekteja.</p>'}</section>`;
    }).join('');
  const message = error === undefined ? '' : `<p class="notice error" role="alert">${esc(error)}</p>`;
  return layout('Prospektit', `<h1>Prospektit</h1>${message}
    <h2>Uusi prospekti</h2>
    <form class="stack card" action="/admin/prospects" method="post">${formToken(csrf)}
      <div class="fields">${field('Nimi *', 'name')}${field('Y-tunnus', 'yTunnus')}${field('Kunta', 'municipality')}${field('Toimiala', 'vertical')}${field('Lähde', 'source')}${field('Sähköposti', 'contactEmail', 'email')}${field('Puhelin', 'contactPhone')}</div>
      <label>Muistiinpanot<textarea name="notes"></textarea></label><div><button type="submit">Luo prospekti</button></div>
    </form>
    <h2>Putki</h2><div class="filters">${filters}</div><div class="kanban">${columns}</div>`, csrf);
}

export function prospectDetailPage(
  prospect: Prospect,
  csrf: string,
  transitions: readonly ProspectStatus[],
  error?: string,
): string {
  const message = error === undefined ? '' : `<p class="notice error" role="alert">${esc(error)}</p>`;
  const optional = [
    ['Y-tunnus', prospect.yTunnus], ['Kunta', prospect.municipality], ['Toimiala', prospect.vertical],
    ['Lähde', prospect.source], ['Sähköposti', prospect.contactEmail], ['Puhelin', prospect.contactPhone],
    ['Tilan syy', prospect.statusReason], ['Muistiinpanot', prospect.notes],
  ].filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([label, value]) => `<dt>${esc(label)}</dt><dd>${esc(value)}</dd>`).join('');
  const forms = transitions.map((status) => `<form class="card stack" action="/admin/prospects/${escAttr(prospect.publicId)}/status" method="post">${formToken(csrf)}<input type="hidden" name="status" value="${escAttr(status)}"><strong>${esc(status)}</strong>${status === 'hylatty' ? '<label>Syy *<input name="statusReason" required></label>' : ''}<div><button type="submit">Vaihda tila</button></div></form>`).join('');
  return layout(prospect.name, `<p><a href="/admin/prospects">← Prospektit</a></p><h1>${esc(prospect.name)}</h1>${message}
    <dl class="definition"><dt>ID</dt><dd>${esc(prospect.publicId)}</dd><dt>Tila</dt><dd>${badge(prospect.status)}</dd>${optional}<dt>Luotu</dt><dd>${formatTime(prospect.createdAt)}</dd><dt>Päivitetty</dt><dd>${formatTime(prospect.updatedAt)}</dd></dl>
    <h2>Vaihda tila</h2>${forms || '<p class="muted">Tästä tilasta ei ole sallittuja siirtymiä.</p>'}`, csrf);
}

export function sitesPage(sites: SiteListItem[], csrf: string): string {
  const rows = sites.map((site) => `<tr><td><a href="/admin/sites/${escAttr(site.publicId)}">${esc(site.publicId)}</a></td><td><a href="/admin/sites/${escAttr(site.publicId)}">${esc(site.data.name)}</a></td><td>${badge(site.status)}</td><td>${esc(String(site.currentVersion))}</td><td>${esc(String(site.openProposalCount))}</td><td><a href="/b/${escAttr(site.publicId)}">Julkaistu</a></td></tr>`).join('');
  const table = rows ? `<div class="table-wrap"><table><thead><tr><th>ID</th><th>Nimi</th><th>Tila</th><th>Versio</th><th>Avoimet ehdotukset</th><th>Linkit</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted">Ei sivustoja.</p>';
  return layout('Sivustot', `<h1>Sivustot</h1>${table}`, csrf);
}

export function siteDetailPage(input: {
  site: Site;
  versions: SnapshotMeta[];
  proposals: OpenProposal[];
  photoCount: number;
  events: AuditEventRecord[];
  csrf: string;
  error?: string;
}): string {
  const { site, versions, proposals, photoCount, events, csrf, error } = input;
  const message = error === undefined ? '' : `<p class="notice error" role="alert">${esc(error)}</p>`;
  const proposalHtml = proposals.map((proposal) => {
    const summary = proposal.summary.length ? `<ul class="summary">${proposal.summary.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : '<p class="muted">Ei yhteenvetoa.</p>';
    return `<div class="proposal"><strong>${esc(proposal.proposalId)}</strong> · ${formatTime(proposal.at)} · <a href="/p/${escAttr(site.publicId)}/${escAttr(proposal.proposalId)}">Esikatselu</a>${summary}<div class="actions"><form action="/admin/sites/${escAttr(site.publicId)}/proposals/${escAttr(proposal.proposalId)}/approve" method="post">${formToken(csrf)}<button type="submit">Hyväksy</button></form><form action="/admin/sites/${escAttr(site.publicId)}/proposals/${escAttr(proposal.proposalId)}/reject" method="post">${formToken(csrf)}<button class="danger" type="submit">Hylkää</button></form></div></div>`;
  }).join('') || '<p class="muted">Ei avoimia ehdotuksia.</p>';
  const versionRows = versions.map((version) => `<tr><td>${esc(String(version.n))}</td><td>${formatTime(version.at)}</td><td>${esc(version.note ?? '')}</td><td><form action="/admin/sites/${escAttr(site.publicId)}/rollback" method="post">${formToken(csrf)}<input type="hidden" name="to" value="${escAttr(String(version.n))}"><button class="secondary" type="submit">Palauta</button></form></td></tr>`).join('');
  const versionTable = versionRows ? `<div class="table-wrap"><table><thead><tr><th>n</th><th>Aika</th><th>Huomio</th><th></th></tr></thead><tbody>${versionRows}</tbody></table></div>` : '<p class="muted">Ei aiempia versioita.</p>';
  return layout(site.data.name, `<p><a href="/admin/sites">← Sivustot</a></p><h1>${esc(site.data.name)}</h1>${message}
    <dl class="definition"><dt>ID</dt><dd>${esc(site.publicId)}</dd><dt>Kuvaus</dt><dd>${esc(site.data.tagline ?? '—')}</dd><dt>Tila</dt><dd>${badge(site.status)}</dd><dt>Nykyinen versio</dt><dd>${esc(String(site.currentVersion))}</dd><dt>Kuvia</dt><dd>${esc(String(photoCount))}</dd><dt>Linkki</dt><dd><a href="/b/${escAttr(site.publicId)}">/b/${esc(site.publicId)}</a></dd></dl>
    <h2>Avoimet ehdotukset</h2><div class="card">${proposalHtml}</div>
    <h2>Versiot</h2>${versionTable}
    <h2>Tapahtumat</h2>${auditTable(events)}`, csrf);
}

export function auditPage(input: {
  events: AuditEventRecord[];
  csrf: string;
  entity?: string;
  entityId?: string;
  nextBefore?: number;
}): string {
  const { events, csrf, entity, entityId, nextBefore } = input;
  const params = new URLSearchParams();
  if (entity !== undefined) params.set('entity', entity);
  if (entityId !== undefined) params.set('entityId', entityId);
  if (nextBefore !== undefined) params.set('before', String(nextBefore));
  const next = nextBefore === undefined ? '' : `<p><a class="button" href="/admin/audit?${escAttr(params.toString())}">Vanhemmat tapahtumat →</a></p>`;
  return layout('Loki', `<h1>Audit-loki</h1>
    <form class="card fields" action="/admin/audit" method="get"><label>Kohdetyyppi<input name="entity" value="${escAttr(entity ?? '')}" placeholder="site"></label><label>Kohteen ID<input name="entityId" value="${escAttr(entityId ?? '')}"></label><div class="actions"><button type="submit">Suodata</button><a href="/admin/audit">Tyhjennä</a></div></form>
    <h2>Tapahtumat</h2>${auditTable(events)}${next}`, csrf);
}

export function messagePage(title: string, message: string, csrf: string): string {
  return layout(title, `<h1>${esc(title)}</h1><p class="notice error">${esc(message)}</p><p><a href="/admin">Dashboardille</a></p>`, csrf);
}
