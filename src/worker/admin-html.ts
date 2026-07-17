import { esc, escAttr } from '../engine/escape.js';
import {
  BUSINESS_PROFILE_LIMITS,
  type BusinessProfile,
  type ProvenanceSource,
} from './business-profile.js';
import type {
  AuditEventRecord,
  BillingEvent,
  BusinessProfileRecord,
  DraftComment,
  OpenProposal,
  Order,
  ProvisioningRun,
  ProvisioningStep,
  Renewal,
  LaunchChecklistRecord,
  PreviewToken,
  PanelToken,
  Prospect,
  ProspectStatus,
  Site,
  SiteListItem,
  SnapshotMeta,
  StatusCounts,
  QaRun,
  UpdateRequest,
  UpdateRequestStatus,
} from './db.js';
import { ORDER_STATUSES, PROSPECT_STATUSES, SITE_STATUSES } from './db.js';
import { LAUNCH_CHECKLIST_ITEMS } from './qa.js';
import { PROVISIONING_STEPS } from './provisioning.js';

function formToken(csrf: string): string {
  return `<input type="hidden" name="csrf" value="${escAttr(csrf)}">`;
}

function badge(status: string): string {
  return `<span class="badge">${esc(status)}</span>`;
}

const ORDER_STATUS_FI = {
  luotu: 'Luotu',
  maksettu: 'Maksettu',
  peruttu: 'Peruttu',
  maksu_epaonnistui: 'Maksu epäonnistui',
  irtisanottu: 'Irtisanottu',
} as const;

function orderBadge(status: Order['status']): string {
  return badge(ORDER_STATUS_FI[status]);
}

function formatTime(at: number): string {
  const iso = new Date(at).toISOString();
  return `<time datetime="${escAttr(iso)}">${esc(iso.slice(0, 16).replace('T', ' '))} UTC</time>`;
}

function field(label: string, name: string, type = 'text'): string {
  return `<label>${esc(label)}<input name="${escAttr(name)}" type="${escAttr(type)}"></label>`;
}

function valueField(label: string, name: string, value?: string, type = 'text'): string {
  return `<label>${esc(label)}<input name="${escAttr(name)}" type="${escAttr(type)}" value="${escAttr(value ?? '')}"></label>`;
}

function sourceSelect(name: string, selected: ProvenanceSource = 'operator', copyOnly = false): string {
  const sources: ProvenanceSource[] = copyOnly ? ['owner', 'operator'] : ['prh', 'places', 'owner', 'operator'];
  return `<select name="${escAttr(name)}" aria-label="Tietolähde">${sources.map((source) => `<option value="${escAttr(source)}"${source === selected ? ' selected' : ''}>${esc(source)}</option>`).join('')}</select>`;
}

function sourceFor(profile: BusinessProfile, path: string): ProvenanceSource {
  return profile.provenance[path]?.source ?? 'operator';
}

export function layout(title: string, content: string, csrf?: string): string {
  const navigation = csrf === undefined
    ? '<a class="brand" href="/admin/login">Pageforge</a>'
    : `<a class="brand" href="/admin">Pageforge</a>
       <nav aria-label="Päänavigaatio">
         <a href="/admin">Dashboard</a>
         <a href="/admin/prospects">Prospektit</a>
         <a href="/admin/sites">Sivustot</a>
         <a href="/admin/provisioning">Provisiointi</a>
         <a href="/admin/updates">Päivityspyynnöt</a>
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
  const orderCards = ORDER_STATUSES.map((status) => `<div class="card"><div>${orderBadge(status)}</div><div class="number">${esc(String(counts.orders[status]))}</div></div>`).join('');
  return layout('Dashboard', `<h1>Dashboard</h1>
    <h2>Prospektit</h2><div class="grid">${prospectCards}</div>
    <h2>Sivustot</h2><div class="grid">${siteCards}<div class="card"><div>Avoimet ehdotukset</div><div class="number">${esc(String(counts.openProposals))}</div></div><a class="card" href="/admin/updates"><div>Avoimet päivityspyynnöt</div><div class="number">${esc(String(counts.openUpdateRequests))}</div></a></div>
    <h2>Tilaukset</h2><div class="grid">${orderCards}</div>
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
  profile?: BusinessProfileRecord,
  warnings: string[] = [],
  site?: Site,
): string {
  const message = error === undefined ? '' : `<p class="notice error" role="alert">${esc(error)}</p>`;
  const optional = [
    ['Y-tunnus', prospect.yTunnus], ['Kunta', prospect.municipality], ['Toimiala', prospect.vertical],
    ['Lähde', prospect.source], ['Sähköposti', prospect.contactEmail], ['Puhelin', prospect.contactPhone],
    ['Tilan syy', prospect.statusReason], ['Muistiinpanot', prospect.notes],
  ].filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([label, value]) => `<dt>${esc(label)}</dt><dd>${esc(value)}</dd>`).join('');
  const forms = transitions.map((status) => `<form class="card stack" action="/admin/prospects/${escAttr(prospect.publicId)}/status" method="post">${formToken(csrf)}<input type="hidden" name="status" value="${escAttr(status)}"><strong>${esc(status)}</strong>${status === 'hylatty' ? '<label>Syy *<input name="statusReason" required></label>' : ''}<div><button type="submit">Vaihda tila</button></div></form>`).join('');
  const warningHtml = warnings.length
    ? `<div class="notice"><strong>Ristiriidat</strong><ul>${warnings.map((warning) => `<li>${esc(warning)}</li>`).join('')}</ul></div>`
    : '<p class="muted">Ei havaittuja ristiriitoja.</p>';
  const profileCard = profile
    ? `<div class="card"><p><strong>${esc(profile.data.identity.name)}</strong> · päivitetty ${formatTime(profile.updatedAt)}</p>${warningHtml}<div class="actions"><a class="button" href="/admin/prospects/${escAttr(prospect.publicId)}/intake">Muokkaa intakea</a>${site
      ? `<a href="/admin/sites/${escAttr(site.publicId)}">Avaa sivusto ${esc(site.publicId)}</a>`
      : `<form action="/admin/prospects/${escAttr(prospect.publicId)}/compose" method="post">${formToken(csrf)}<button type="submit">Luo kolme versiota</button></form>`}</div></div>`
    : `<div class="card"><p class="muted">Intakea ei ole vielä tallennettu.</p><a class="button" href="/admin/prospects/${escAttr(prospect.publicId)}/intake">Täytä intake</a></div>`;
  return layout(prospect.name, `<p><a href="/admin/prospects">← Prospektit</a></p><h1>${esc(prospect.name)}</h1>${message}
    <dl class="definition"><dt>ID</dt><dd>${esc(prospect.publicId)}</dd><dt>Tila</dt><dd>${badge(prospect.status)}</dd>${optional}<dt>Luotu</dt><dd>${formatTime(prospect.createdAt)}</dd><dt>Päivitetty</dt><dd>${formatTime(prospect.updatedAt)}</dd></dl>
    <h2>BusinessProfile</h2>${profileCard}
    <h2>Vaihda tila</h2>${forms || '<p class="muted">Tästä tilasta ei ole sallittuja siirtymiä.</p>'}`, csrf);
}

export function intakePage(input: {
  prospect: Prospect;
  profile: BusinessProfile;
  csrf: string;
  errors?: string[];
  warnings?: string[];
}): string {
  const { prospect, profile, csrf, errors = [], warnings = [] } = input;
  const errorHtml = errors.length
    ? `<div class="notice error" role="alert"><strong>Korjaa tiedot</strong><ul>${errors.map((error) => `<li>${esc(error)}</li>`).join('')}</ul></div>`
    : '';
  const warningHtml = warnings.length
    ? `<div class="notice"><strong>Ristiriidat</strong><ul>${warnings.map((warning) => `<li>${esc(warning)}</li>`).join('')}</ul></div>`
    : '';
  const identitySource = sourceFor(profile, 'identity.name');
  const contactSource = sourceFor(profile, 'contact.phone');
  const hourRows = Array.from({ length: BUSINESS_PROFILE_LIMITS.hours }, (_, index) => {
    const row = profile.hours[index];
    return `<tr><td><input aria-label="Päivä ${index + 1}" name="hours_${index}_label" value="${escAttr(row?.label ?? '')}"></td><td><input aria-label="Aukeaa ${index + 1}" name="hours_${index}_open" value="${escAttr(row?.open ?? '')}" placeholder="09:00"></td><td><input aria-label="Sulkeutuu ${index + 1}" name="hours_${index}_close" value="${escAttr(row?.close ?? '')}" placeholder="17:00"></td><td><input aria-label="Suljettu ${index + 1}" name="hours_${index}_closed" type="checkbox"${row?.closed ? ' checked' : ''}></td><td>${sourceSelect(`hours_${index}_source`, sourceFor(profile, `hours.${index}.label`))}</td></tr>`;
  }).join('');
  const itemTable = (prefix: 'services' | 'menu', title: string): string => {
    const items = profile[prefix];
    const rows = Array.from({ length: BUSINESS_PROFILE_LIMITS[prefix] }, (_, index) => {
      const item = items[index];
      return `<tr><td><input aria-label="${escAttr(title)} nimi ${index + 1}" name="${prefix}_${index}_name" value="${escAttr(item?.name ?? '')}"></td><td><input aria-label="${escAttr(title)} hinta ${index + 1}" name="${prefix}_${index}_price" value="${escAttr(item?.price ?? '')}" placeholder="35 €"></td><td><textarea aria-label="${escAttr(title)} kuvaus ${index + 1}" name="${prefix}_${index}_desc">${esc(item?.desc ?? '')}</textarea></td><td>${sourceSelect(`${prefix}_${index}_source`, sourceFor(profile, `${prefix}.${index}.name`), Boolean(item?.desc))}</td></tr>`;
    }).join('');
    return `<h2>${esc(title)}</h2><div class="table-wrap"><table><thead><tr><th>Nimi</th><th>Hinta</th><th>Kuvaus</th><th>Lähde</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  };
  const photoRows = Array.from({ length: BUSINESS_PROFILE_LIMITS.photos }, (_, index) => `<tr><td><input aria-label="Kuvapolku ${index + 1}" name="photos_${index}_src" value="${escAttr(profile.photos[index]?.src ?? '')}" placeholder="/img/sha256"></td><td>${sourceSelect(`photos_${index}_source`, sourceFor(profile, `photos.${index}.src`))}</td></tr>`).join('');
  const linkKinds = ['', 'website', 'phone', 'instagram', 'facebook', 'linkedin', 'youtube', 'github', 'x', 'email'];
  const linkRows = Array.from({ length: BUSINESS_PROFILE_LIMITS.links }, (_, index) => {
    const link = profile.links[index];
    return `<tr><td><input aria-label="Linkin nimi ${index + 1}" name="links_${index}_label" value="${escAttr(link?.label ?? '')}"></td><td><input aria-label="Linkin URL ${index + 1}" name="links_${index}_url" type="url" value="${escAttr(link?.url ?? '')}" placeholder="https://"></td><td><select aria-label="Linkin tyyppi ${index + 1}" name="links_${index}_kind">${linkKinds.map((kind) => `<option value="${escAttr(kind)}"${kind === (link?.kind ?? '') ? ' selected' : ''}>${esc(kind || '—')}</option>`).join('')}</select></td><td>${sourceSelect(`links_${index}_source`, sourceFor(profile, `links.${index}.label`))}</td></tr>`;
  }).join('');
  const vertical = profile.identity.vertical;
  const address = profile.contact.address;
  return layout(`Intake: ${prospect.name}`, `<p><a href="/admin/prospects/${escAttr(prospect.publicId)}">← ${esc(prospect.name)}</a></p><h1>BusinessProfile intake</h1>${errorHtml}${warningHtml}
    <form class="stack" action="/admin/prospects/${escAttr(prospect.publicId)}/intake" method="post">${formToken(csrf)}
      <section class="card"><h2>Identiteetti</h2><div class="fields">${valueField('Nimi *', 'name', profile.identity.name)}${valueField('Y-tunnus', 'yTunnus', profile.identity.yTunnus)}${valueField('Toimialakoodi', 'vertical_code', vertical?.code)}${valueField('Toimialan nimi', 'vertical_label', vertical?.label)}<label>Tietolähde${sourceSelect('identity_source', identitySource)}</label></div></section>
      <section class="card"><h2>Yhteystiedot</h2><div class="fields">${valueField('Puhelin', 'phone', profile.contact.phone)}${valueField('Sähköposti', 'email', profile.contact.email, 'email')}${valueField('Katuosoite', 'street', address?.street)}${valueField('Postinumero', 'postal', address?.postal)}${valueField('Kaupunki', 'city', address?.city)}<label>Tietolähde${sourceSelect('contact_source', contactSource)}</label></div></section>
      <h2>Aukioloajat</h2><div class="table-wrap"><table><thead><tr><th>Päivä</th><th>Aukeaa</th><th>Sulkeutuu</th><th>Suljettu</th><th>Lähde</th></tr></thead><tbody>${hourRows}</tbody></table></div>
      ${itemTable('services', 'Palvelut')}${itemTable('menu', 'Ruokalista')}
      <section class="card"><h2>Tekstit</h2><label>Iskulause<textarea name="tagline">${esc(profile.tagline ?? '')}</textarea>${sourceSelect('tagline_source', sourceFor(profile, 'tagline'), true)}</label><label>Esittely<textarea name="about">${esc(profile.about ?? '')}</textarea>${sourceSelect('about_source', sourceFor(profile, 'about'), true)}</label></section>
      <h2>Kuvat</h2><div class="table-wrap"><table><thead><tr><th>R2-polku</th><th>Lähde</th></tr></thead><tbody>${photoRows}</tbody></table></div>
      <h2>Linkit</h2><div class="table-wrap"><table><thead><tr><th>Nimi</th><th>HTTPS-URL</th><th>Tyyppi</th><th>Lähde</th></tr></thead><tbody>${linkRows}</tbody></table></div>
      <section class="card"><h2>Suostumus</h2><label><span><input name="consent_photos" type="checkbox"${profile.consent.photos ? ' checked' : ''}> Kuvien käyttö vahvistettu</span></label><label><span><input name="consent_texts" type="checkbox"${profile.consent.texts ? ' checked' : ''}> Tekstien käyttö vahvistettu</span></label><label>Huomio<textarea name="consent_note">${esc(profile.consent.note ?? '')}</textarea></label></section>
      <div><button type="submit">Tallenna BusinessProfile</button></div>
    </form>`, csrf);
}

export function sitesPage(sites: SiteListItem[], csrf: string): string {
  const rows = sites.map((site) => `<tr><td><a href="/admin/sites/${escAttr(site.publicId)}">${esc(site.publicId)}</a></td><td><a href="/admin/sites/${escAttr(site.publicId)}">${esc(site.data.name)}</a></td><td>${badge(site.status)}</td><td>${esc(String(site.currentVersion))}</td><td>${esc(String(site.openProposalCount))}</td><td><a href="/b/${escAttr(site.publicId)}">Julkaistu</a></td></tr>`).join('');
  const table = rows ? `<div class="table-wrap"><table><thead><tr><th>ID</th><th>Nimi</th><th>Tila</th><th>Versio</th><th>Avoimet ehdotukset</th><th>Linkit</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted">Ei sivustoja.</p>';
  return layout('Sivustot', `<h1>Sivustot</h1>${table}`, csrf);
}

export function updatesPage(
  requests: UpdateRequest[],
  csrf: string,
  selected?: UpdateRequestStatus,
  error?: string,
): string {
  const statuses: UpdateRequestStatus[] = ['uusi', 'ehdotettu', 'suljettu'];
  const filters = [`<a${selected === undefined ? ' class="active"' : ''} href="/admin/updates">Kaikki</a>`, ...statuses.map((status) => `<a${selected === status ? ' class="active"' : ''} href="/admin/updates?status=${escAttr(status)}">${esc(status)}</a>`)].join('');
  const rows = requests.map((entry) => {
    const excerpt = entry.body.length > 180 ? `${entry.body.slice(0, 180)}…` : entry.body;
    const close = entry.status === 'suljettu' ? '' : `<form action="/admin/updates/${escAttr(String(entry.id))}/close" method="post">${formToken(csrf)}<button class="danger" type="submit">Sulje</button></form>`;
    return `<tr><td>${esc(String(entry.id))}</td><td>${formatTime(entry.createdAt)}</td><td><a href="/admin/sites/${escAttr(entry.sitePublicId)}">${esc(entry.siteName)}<br><span class="muted">${esc(entry.sitePublicId)}</span></a></td><td>${esc(entry.channel)}</td><td>${esc(entry.fromAddr ?? '—')}</td><td>${esc(entry.subject ?? '')}<br><span class="muted">${esc(excerpt)}</span></td><td>${badge(entry.status)}</td><td>${close}</td></tr>`;
  }).join('');
  const table = rows ? `<div class="table-wrap"><table><thead><tr><th>ID</th><th>Aika</th><th>Sivusto</th><th>Kanava</th><th>Lähettäjä</th><th>Sisältö</th><th>Tila</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted">Ei päivityspyyntöjä.</p>';
  const message = error === undefined ? '' : `<p class="notice error" role="alert">${esc(error)}</p>`;
  return layout('Päivityspyynnöt', `<h1>Päivityspyynnöt</h1>${message}<div class="filters">${filters}</div>${table}`, csrf);
}

export function siteDetailPage(input: {
  site: Site;
  versions: SnapshotMeta[];
  proposals: OpenProposal[];
  photoCount: number;
  events: AuditEventRecord[];
  tokens: PreviewToken[];
  panelTokens: PanelToken[];
  updateRequests: UpdateRequest[];
  comments: DraftComment[];
  qaRun?: QaRun;
  checklist: LaunchChecklistRecord[];
  publishGateMessage: string;
  order?: Order;
  billingEvents: BillingEvent[];
  provisioningRun?: ProvisioningRun;
  provisioningSteps: ProvisioningStep[];
  renewals: Renewal[];
  csrf: string;
  error?: string;
}): string {
  const {
    site, versions, proposals, photoCount, events, tokens, panelTokens, updateRequests, comments,
    qaRun, checklist, publishGateMessage, order, billingEvents,
    provisioningRun, provisioningSteps, renewals, csrf, error,
  } = input;
  const message = error === undefined ? '' : `<p class="notice error" role="alert">${esc(error)}</p>`;
  const proposalHtml = proposals.map((proposal) => {
    const summary = proposal.summary.length ? `<ul class="summary">${proposal.summary.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : '<p class="muted">Ei yhteenvetoa.</p>';
    return `<div class="proposal"><strong>${esc(proposal.proposalId)}</strong> · ${formatTime(proposal.at)} · <a href="/p/${escAttr(site.publicId)}/${escAttr(proposal.proposalId)}">Esikatselu</a>${summary}<div class="actions"><form action="/admin/sites/${escAttr(site.publicId)}/proposals/${escAttr(proposal.proposalId)}/approve" method="post">${formToken(csrf)}<button type="submit">Hyväksy</button></form><form action="/admin/sites/${escAttr(site.publicId)}/proposals/${escAttr(proposal.proposalId)}/reject" method="post">${formToken(csrf)}<button class="danger" type="submit">Hylkää</button></form></div></div>`;
  }).join('') || '<p class="muted">Ei avoimia ehdotuksia.</p>';
  const publishForm = (n: number): string => `<form class="stack" action="/admin/sites/${escAttr(site.publicId)}/publish" method="post">${formToken(csrf)}<input type="hidden" name="n" value="${escAttr(String(n))}"><button type="submit">Julkaise versio ${esc(String(n))}</button><details><summary>Operaattorin ohitus</summary><label><span><input name="override" type="checkbox" value="true"> Ohita julkaisuportti</span></label><label>Syy<input name="reason"></label></details></form>`;
  const versionRows = versions.map((version) => `<tr><td>${esc(String(version.n))}</td><td>${formatTime(version.at)}</td><td>${esc(version.note ?? '')}</td><td><div class="actions"><form action="/admin/sites/${escAttr(site.publicId)}/rollback" method="post">${formToken(csrf)}<input type="hidden" name="to" value="${escAttr(String(version.n))}"><button class="secondary" type="submit">Palauta</button></form>${publishForm(version.n)}</div></td></tr>`).join('');
  const versionTable = versionRows ? `<div class="table-wrap"><table><thead><tr><th>n</th><th>Aika</th><th>Huomio</th><th></th></tr></thead><tbody>${versionRows}</tbody></table></div>` : '<p class="muted">Ei aiempia versioita.</p>';
  const tokenRows = tokens.map((token) => `<tr><td>${esc(token.label)}</td><td>${esc(token.proposalPublicId ?? 'Koko sivusto')}</td><td>${formatTime(token.expiresAt)}</td><td><form action="/admin/sites/${escAttr(site.publicId)}/tokens/${escAttr(String(token.id))}/revoke" method="post">${formToken(csrf)}<button class="danger" type="submit">Peru</button></form></td></tr>`).join('');
  const tokenTable = tokenRows ? `<div class="table-wrap"><table><thead><tr><th>Nimi</th><th>Rajaus</th><th>Vanhenee</th><th></th></tr></thead><tbody>${tokenRows}</tbody></table></div>` : '<p class="muted">Ei aktiivisia esikatselulinkkejä.</p>';
  const panelTokenRows = panelTokens.map((token) => `<tr><td>${formatTime(token.createdAt)}</td><td>${formatTime(token.expiresAt)}</td><td><form action="/admin/sites/${escAttr(site.publicId)}/panel-tokens/${escAttr(String(token.id))}/revoke" method="post">${formToken(csrf)}<button class="danger" type="submit">Peru</button></form></td></tr>`).join('');
  const panelTokenTable = panelTokenRows ? `<div class="table-wrap"><table><thead><tr><th>Luotu</th><th>Vanhenee</th><th></th></tr></thead><tbody>${panelTokenRows}</tbody></table></div>` : '<p class="muted">Ei aktiivisia asiakaspaneelilinkkejä.</p>';
  const updateRows = updateRequests.map((entry) => `<tr><td><a href="/admin/updates">${esc(String(entry.id))}</a></td><td>${formatTime(entry.createdAt)}</td><td>${esc(entry.channel)}</td><td>${esc(entry.fromAddr ?? '—')}</td><td>${badge(entry.status)}</td><td>${esc(entry.subject ?? '')}<br><span class="muted">${esc(entry.body.length > 180 ? `${entry.body.slice(0, 180)}…` : entry.body)}</span></td></tr>`).join('');
  const updateTable = updateRows ? `<div class="table-wrap"><table><thead><tr><th>ID</th><th>Aika</th><th>Kanava</th><th>Lähettäjä</th><th>Tila</th><th>Sisältö</th></tr></thead><tbody>${updateRows}</tbody></table></div>` : '<p class="muted">Ei avoimia päivityspyyntöjä.</p>';
  const proposalOptions = proposals.map((proposal) => `<option value="${escAttr(proposal.proposalId)}">${esc(proposal.proposalId)}</option>`).join('');
  const commentRows = comments.map((comment) => `<tr><td>${formatTime(comment.createdAt)}</td><td>${esc(comment.proposalPublicId ?? 'Koko sivusto')}</td><td>${esc(comment.author)}</td><td>${esc(comment.body)}</td></tr>`).join('');
  const commentTable = commentRows ? `<div class="table-wrap"><table><thead><tr><th>Aika</th><th>Ehdotus</th><th>Kirjoittaja</th><th>Kommentti</th></tr></thead><tbody>${commentRows}</tbody></table></div>` : '<p class="muted">Ei kommentteja.</p>';
  const orderDetails = order === undefined
    ? '<p class="muted">Ei tilausta.</p>'
    : `<dl class="definition"><dt>Tila</dt><dd>${orderBadge(order.status)}</dd><dt>Tilaus-ID</dt><dd>${esc(order.publicId)}</dd><dt>Palveluntarjoaja</dt><dd>${esc(order.provider)}</dd><dt>Hinta</dt><dd>${esc((order.amountBuildCents / 100).toFixed(2))} € + ${esc((order.amountMonthlyCents / 100).toFixed(2))} €/kk</dd></dl>`;
  const billingRows = billingEvents.map((event) => `<tr><td>${formatTime(event.createdAt)}</td><td>${esc(event.type)}</td><td><code>${esc(event.payload.length > 300 ? `${event.payload.slice(0, 300)}…` : event.payload)}</code></td></tr>`).join('');
  const billingTable = billingRows
    ? `<div class="table-wrap"><table><thead><tr><th>Aika</th><th>Tyyppi</th><th>Raakatapahtuma</th></tr></thead><tbody>${billingRows}</tbody></table></div>`
    : '<p class="muted">Ei laskutustapahtumia.</p>';
  const orderBlock = `${orderDetails}<form action="/admin/sites/${escAttr(site.publicId)}/order" method="post">${formToken(csrf)}<button type="submit">Luo tilaus</button></form><h3>Laskutustapahtumat</h3>${billingTable}`;
  const provisioningRows = provisioningSteps.map((step) => {
    const definition = PROVISIONING_STEP_LABELS[step.step] ?? step.step;
    const controls = provisioningRun?.status !== 'kaynnissa' ? '' : `<div class="actions">
      <form class="stack" action="/admin/sites/${escAttr(site.publicId)}/provisioning/steps/${escAttr(step.step)}" method="post">${formToken(csrf)}<input type="hidden" name="status" value="tehty"><label>Evidenssi<textarea name="evidence">${esc(step.evidence ?? '')}</textarea></label><button type="submit">Merkitse tehdyksi</button></form>
      <form action="/admin/sites/${escAttr(site.publicId)}/provisioning/steps/${escAttr(step.step)}" method="post">${formToken(csrf)}<input type="hidden" name="status" value="ohitettu"><button class="secondary" type="submit">Ohita</button></form>
    </div>`;
    return `<tr><td>${esc(String(step.ord))}</td><td>${esc(definition)}</td><td>${badge(step.status)}</td><td>${esc(step.evidence ?? '')}</td><td>${controls}</td></tr>`;
  }).join('');
  const provisioningTable = provisioningRows
    ? `<div class="table-wrap"><table><thead><tr><th>#</th><th>Vaihe</th><th>Tila</th><th>Evidenssi</th><th></th></tr></thead><tbody>${provisioningRows}</tbody></table></div>`
    : '<p class="muted">Provisiointia ei ole aloitettu.</p>';
  const provisioningHeader = provisioningRun === undefined
    ? `<form class="card stack" action="/admin/sites/${escAttr(site.publicId)}/provisioning/start" method="post">${formToken(csrf)}<label>Verkkotunnus *<input name="domain" required maxlength="72" pattern="^[a-z0-9][a-z0-9.-]{2,60}\\.[a-z]{2,10}$" placeholder="yritys.fi"></label><div><button type="submit">Aloita provisiointi</button></div></form>`
    : `<dl class="definition"><dt>Ajo</dt><dd>${esc(provisioningRun.publicId)}</dd><dt>Verkkotunnus</dt><dd>${esc(provisioningRun.domain)}</dd><dt>Tila</dt><dd>${badge(provisioningRun.status)}</dd></dl>${provisioningRun.status === 'kaynnissa' ? `<form action="/admin/sites/${escAttr(site.publicId)}/provisioning/abort" method="post">${formToken(csrf)}<button class="danger" type="submit">Keskeytä provisiointi</button></form>` : `<form class="card stack" action="/admin/sites/${escAttr(site.publicId)}/provisioning/start" method="post">${formToken(csrf)}<label>Uusi verkkotunnus *<input name="domain" required maxlength="72" pattern="^[a-z0-9][a-z0-9.-]{2,60}\\.[a-z]{2,10}$"></label><div><button type="submit">Aloita uusi provisiointi</button></div></form>`}`;
  const renewalRows = renewals.map((renewal) => `<tr><td>${esc(renewal.kind)}</td><td>${esc(renewal.label)}</td><td>${formatTime(renewal.dueAt)}</td><td>${badge(renewal.status)}</td></tr>`).join('');
  const renewalTable = renewalRows
    ? `<div class="table-wrap"><table><thead><tr><th>Tyyppi</th><th>Nimi</th><th>Erääntyy</th><th>Tila</th></tr></thead><tbody>${renewalRows}</tbody></table></div>`
    : '<p class="muted">Ei uusintoja.</p>';
  const qaRows = qaRun?.results.map((result) => `<tr><td>${esc(result.label)}</td><td>${result.passed ? 'Läpäisi' : 'Hylätty'}</td><td>${esc(result.detail ?? '')}</td></tr>`).join('') ?? '';
  const qaTable = qaRun
    ? `<p>Versio ${esc(String(qaRun.version))} · ${formatTime(qaRun.createdAt)} · <strong>${qaRun.passed ? 'Läpäisi' : 'Hylätty'}</strong></p><div class="table-wrap"><table><thead><tr><th>Tarkistus</th><th>Tulos</th><th>Lisätieto</th></tr></thead><tbody>${qaRows}</tbody></table></div>`
    : '<p class="muted">Tarkistuksia ei ole vielä ajettu.</p>';
  const checkedIds = new Set(checklist.map((entry) => entry.item));
  const checklistHtml = LAUNCH_CHECKLIST_ITEMS.map((item) => {
    const checked = checkedIds.has(item.id);
    return `<form class="card" action="/admin/sites/${escAttr(site.publicId)}/checklist/${escAttr(item.id)}" method="post">${formToken(csrf)}<label><span><input name="checked" type="checkbox" value="true"${checked ? ' checked' : ''}> ${esc(item.label)}</span></label><button class="secondary" type="submit">Tallenna</button></form>`;
  }).join('');
  const gateHint = publishGateMessage ? `<p class="notice">Julkaisuportti ei täyty. ${esc(publishGateMessage)}</p>` : '<p class="notice">Julkaisuportti täyttyy.</p>';
  const publishControls = `${gateHint}<div class="actions">${publishForm(site.currentVersion)}${site.publishedVersion === undefined ? '' : `<form action="/admin/sites/${escAttr(site.publicId)}/unpublish" method="post">${formToken(csrf)}<button class="danger" type="submit">Poista julkaisu</button></form>`}</div>`;
  return layout(site.data.name, `<p><a href="/admin/sites">← Sivustot</a></p><h1>${esc(site.data.name)}</h1>${message}
    <dl class="definition"><dt>ID</dt><dd>${esc(site.publicId)}</dd><dt>Kuvaus</dt><dd>${esc(site.data.tagline ?? '—')}</dd><dt>Tila</dt><dd>${badge(site.status)}</dd><dt>Nykyinen versio</dt><dd>${esc(String(site.currentVersion))}</dd><dt>Julkaistu versio</dt><dd>${esc(site.publishedVersion === undefined ? '—' : String(site.publishedVersion))}</dd><dt>Kuvia</dt><dd>${esc(String(photoCount))}</dd><dt>Nykyisen esikatselu</dt><dd><a href="/p/${escAttr(site.publicId)}/current">/p/${esc(site.publicId)}/current</a></dd></dl>${publishControls}
    <h2>Tilaus</h2>${orderBlock}
    <h2>Provisiointi</h2>${provisioningHeader}${provisioningTable}<h3>Uusinnat</h3>${renewalTable}
    <h2>QA</h2><form action="/admin/sites/${escAttr(site.publicId)}/qa" method="post">${formToken(csrf)}<button type="submit">Aja tarkistukset</button></form>${qaTable}
    <h3>Julkaisun tarkistuslista</h3><div class="grid">${checklistHtml}</div>
    <h2>Avoimet ehdotukset</h2><div class="card">${proposalHtml}</div>
    <h2>Avoimet päivityspyynnöt</h2>${updateTable}
    <h2>Versiot</h2>${versionTable}
    <h2>Esikatselulinkit</h2>${tokenTable}
    <h3>Uusi esikatselulinkki</h3><form class="card fields" action="/admin/sites/${escAttr(site.publicId)}/tokens" method="post">${formToken(csrf)}<label>Nimi *<input name="label" required maxlength="100"></label><label>Voimassa päivää *<input name="days" type="number" min="1" max="60" value="14" required></label><label>Ehdotus (valinnainen)<select name="proposal"><option value="">Koko sivusto</option>${proposalOptions}</select></label><div class="actions"><button type="submit">Luo linkki</button></div></form>
    <h2>Asiakaspaneelilinkit</h2>${panelTokenTable}<form class="card" action="/admin/sites/${escAttr(site.publicId)}/panel-tokens" method="post">${formToken(csrf)}<button type="submit">Luo 30 päivän paneelilinkki</button></form>
    <h2>Kommentit</h2>${commentTable}
    <h2>Tapahtumat</h2>${auditTable(events)}`, csrf);
}

const PROVISIONING_STEP_LABELS: Record<string, string> = Object.fromEntries(
  PROVISIONING_STEPS.map((step) => [step.id, step.label]),
);

export function provisioningPage(
  runs: ProvisioningRun[],
  renewals: Renewal[],
  csrf: string,
): string {
  const runRows = runs.map((run) => `<tr><td>${esc(run.publicId)}</td><td><a href="/admin/sites/${escAttr(run.sitePublicId ?? '')}">${esc(run.siteName ?? run.sitePublicId ?? String(run.siteId))}</a></td><td>${esc(run.domain)}</td><td>${formatTime(run.createdAt)}</td><td>${badge(run.status)}</td></tr>`).join('');
  const runTable = runRows
    ? `<div class="table-wrap"><table><thead><tr><th>Ajo</th><th>Sivusto</th><th>Verkkotunnus</th><th>Aloitettu</th><th>Tila</th></tr></thead><tbody>${runRows}</tbody></table></div>`
    : '<p class="muted">Ei käynnissä olevia provisiointeja.</p>';
  const renewalRows = renewals.map((renewal) => `<tr><td><a href="/admin/sites/${escAttr(renewal.sitePublicId ?? '')}">${esc(renewal.siteName ?? renewal.sitePublicId ?? String(renewal.siteId))}</a></td><td>${esc(renewal.kind)}</td><td>${esc(renewal.label)}</td><td>${formatTime(renewal.dueAt)}</td><td>${badge(renewal.status)}</td></tr>`).join('');
  const renewalTable = renewalRows
    ? `<div class="table-wrap"><table><thead><tr><th>Sivusto</th><th>Tyyppi</th><th>Nimi</th><th>Erääntyy</th><th>Tila</th></tr></thead><tbody>${renewalRows}</tbody></table></div>`
    : '<p class="muted">Ei seuraavan 90 päivän uusintoja.</p>';
  return layout('Provisiointi', `<h1>Provisiointi</h1><h2>Käynnissä olevat ajot</h2>${runTable}<h2>Uusinnat 90 päivän sisällä</h2>${renewalTable}`, csrf);
}

export function previewTokenPage(site: Site, previewUrl: string, csrf: string): string {
  return layout('Esikatselulinkki luotu', `<p><a href="/admin/sites/${escAttr(site.publicId)}">← Takaisin sivustolle</a></p><h1>Esikatselulinkki luotu</h1><p class="notice">Linkki näytetään vain tämän kerran. Kopioi se nyt.</p><p><a href="${escAttr(previewUrl)}">${esc(previewUrl)}</a></p>`, csrf);
}

export function panelTokenPage(site: Site, panelUrl: string, csrf: string): string {
  return layout('Asiakaspaneelilinkki luotu', `<p><a href="/admin/sites/${escAttr(site.publicId)}">← Takaisin sivustolle</a></p><h1>Asiakaspaneelilinkki luotu</h1><p class="notice">Linkki näytetään vain tämän kerran. Kopioi se nyt.</p><p><a href="${escAttr(panelUrl)}">${esc(panelUrl)}</a></p>`, csrf);
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
