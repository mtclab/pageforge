import { esc, escAttr } from '../engine/escape.js';
import {
  BUSINESS_PROFILE_LIMITS,
  type BusinessProfile,
} from './business-profile.js';
import type {
  AuditEventRecord,
  BillingEvent,
  BusinessProfileRecord,
  Claim,
  ClaimStatus,
  DeletionLogRecord,
  DraftComment,
  OpenProposal,
  Order,
  ProvisioningRun,
  ProvisioningStep,
  Renewal,
  LaunchChecklistRecord,
  PreviewToken,
  PanelToken,
  PhotoMeta,
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
import { CLAIM_STATUSES, ORDER_STATUSES, PROSPECT_STATUSES, SITE_STATUSES } from './db.js';
import { LAUNCH_CHECKLIST_ITEMS } from './qa.js';
import { PROVISIONING_STEPS } from './provisioning.js';
import { verticalGroupFor } from './structure-profiles.js';

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

export function layout(title: string, content: string, csrf?: string): string {
  const navigation = csrf === undefined
    ? '<a class="brand" href="/admin/login">Pageforge</a>'
    : `<a class="brand" href="/admin">Pageforge</a>
       <nav aria-label="Päänavigaatio">
         <a href="/admin">Dashboard</a>
         <a href="/admin/prospects">Prospektit</a>
         <a href="/admin/sites">Sivustot</a>
         <a href="/admin/claims">Varaukset</a>
         <a href="/admin/provisioning">Provisiointi</a>
         <a href="/admin/updates">Päivityspyynnöt</a>
         <a href="/admin/audit">Loki</a>
         <a href="/admin/deletions">Poistoloki</a>
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
    :root{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1b2430;background:#f5f7fa;line-height:1.45;scroll-padding-top:4rem}
    *{box-sizing:border-box}body{margin:0}header{background:#fff;border-bottom:1px solid #d8dee8}header>div{max-width:72rem;margin:auto;padding:1rem;display:flex;gap:1.5rem;align-items:center;justify-content:space-between;flex-wrap:wrap}.brand{font-size:1.2rem;font-weight:750;color:#152238;text-decoration:none}nav{display:flex;align-items:center;gap:1rem;flex-wrap:wrap}nav a,.link{color:#174ea6;text-decoration:none;font:inherit}.link{padding:0;border:0;background:none;cursor:pointer}nav form{margin:0}main{max-width:72rem;margin:auto;padding:1.5rem 1rem 3rem}h1{margin-top:0}h2{margin-top:2rem}a{color:#174ea6}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(13rem,1fr));gap:1rem}.card,.column{background:#fff;border:1px solid #d8dee8;border-radius:.5rem;padding:1rem}.card h2,.column h2{margin-top:0}.number{font-size:2rem;font-weight:750}.kanban{display:grid;grid-template-columns:repeat(9,minmax(12rem,1fr));gap:.75rem;overflow-x:auto;padding-bottom:.5rem}.column{padding:.75rem}.column h2{font-size:1rem}.prospect{display:block;border-top:1px solid #e5e9f0;padding:.65rem 0;text-decoration:none}.prospect:first-of-type{border-top:0}.muted{color:#5d6878}.badge{display:inline-block;padding:.12rem .45rem;border-radius:999px;background:#e7eefb;color:#183b6b;font-size:.8rem}table{width:100%;border-collapse:collapse;background:#fff}th,td{padding:.55rem .65rem;border:1px solid #d8dee8;text-align:left;vertical-align:top}th{background:#eef2f7}form.stack{display:grid;gap:.8rem;max-width:40rem}.fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(13rem,1fr));gap:.8rem}label{display:grid;gap:.25rem;font-weight:600}input,select,textarea,button{font:inherit}input,select,textarea{width:100%;padding:.5rem;border:1px solid #aeb8c7;border-radius:.3rem;background:#fff}input[type=checkbox]{width:auto}textarea{min-height:5rem}button,.button{display:inline-block;width:auto;padding:.45rem .7rem;border:1px solid #174ea6;border-radius:.3rem;background:#174ea6;color:#fff;text-decoration:none;cursor:pointer}button.secondary{background:#fff;color:#174ea6}button.danger{border-color:#a12828;background:#a12828}.actions{display:flex;gap:.5rem;align-items:end;flex-wrap:wrap}.actions form{margin:0}.notice{padding:.75rem 1rem;border-radius:.35rem;background:#fff1d6;border:1px solid #e1b85b}.error{background:#fde8e8;border-color:#d78888;color:#791f1f}.filters{display:flex;gap:.5rem;flex-wrap:wrap;margin:1rem 0}.filters a{padding:.3rem .55rem;border:1px solid #bdc7d5;border-radius:.3rem;background:#fff;text-decoration:none}.filters a.active{background:#174ea6;color:#fff;border-color:#174ea6}.summary{margin:.25rem 0;padding-left:1.2rem}.proposal{border-top:1px solid #d8dee8;padding:1rem 0}.proposal:first-of-type{border-top:0}.definition{display:grid;grid-template-columns:max-content 1fr;gap:.4rem 1rem}.definition dt{font-weight:700}.definition dd{margin:0}.nowrap{white-space:nowrap}.repeat-empty{margin:.4rem 0;color:#5d6878}.repeat-actions{display:flex;gap:.5rem;margin-top:.6rem}.repeat-remove{border-color:#a12828;background:#fff;color:#a12828;white-space:nowrap}.anchor-nav{position:sticky;top:0;z-index:10;margin:0 -1rem 1rem;padding:.7rem 1rem;background:#f5f7fa;border-bottom:1px solid #d8dee8}.detail-pairs{display:grid;grid-template-columns:max-content 1fr;gap:.15rem .5rem;margin:0}.detail-pairs dt{font-weight:700}.detail-pairs dd{margin:0;overflow-wrap:anywhere}details>summary{cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere}@media(max-width:45rem){table{font-size:.9rem}.table-wrap{overflow-x:auto}.definition{grid-template-columns:1fr}.definition dd{margin-bottom:.6rem}}
  </style>
</head>
<body>
  <header><div>${navigation}</div></header>
  <main>${content}</main>
  <script src="/rows.js"></script>
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
    const rawDetail = event.detail === undefined ? '' : JSON.stringify(event.detail);
    const detailEntries = event.detail !== null && typeof event.detail === 'object'
      ? Object.entries(event.detail as Record<string, unknown>)
      : [];
    const pairs = detailEntries.length
      ? `<dl class="detail-pairs"${rawDetail.length <= 120 ? ` title="${escAttr(rawDetail)}"` : ''}>${detailEntries.map(([key, value]) => `<dt>${esc(key)}:</dt><dd>${esc(typeof value === 'string' ? value : JSON.stringify(value))}</dd>`).join('')}</dl>`
      : esc(rawDetail);
    const detail = rawDetail.length > 120
      ? `${pairs}<details><summary>Raaka</summary><code>${esc(rawDetail)}</code></details>`
      : pairs;
    let entity = `${esc(event.entity)} / ${esc(event.entityId)}`;
    if (event.entity === 'site') {
      entity = `<a href="/admin/sites/${escAttr(event.entityId)}">${entity}</a>`;
    } else if (event.entity === 'prospect') {
      entity = `<a href="/admin/prospects/${escAttr(event.entityId)}">${entity}</a>`;
    }
    return `<tr><td>${esc(String(event.id))}</td><td class="nowrap">${formatTime(event.at)}</td><td>${esc(event.actor)}</td><td>${esc(event.action)}</td><td>${entity}</td><td>${detail}</td></tr>`;
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
    <h2>Tilaukset</h2><div class="grid">${orderCards}<a class="card" href="/admin/claims?status=uusi"><div>Avoimet varaukset</div><div class="number">${esc(String(counts.openClaims))}</div></a></div>
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
  rowCounts?: Record<string, number>;
  hasSite?: boolean;
}): string {
  const { prospect, profile, csrf, errors = [], warnings = [] } = input;
  const errorHtml = errors.length
    ? `<div class="notice error" role="alert"><strong>Korjaa tiedot</strong><ul>${errors.map((error) => `<li>${esc(error)}</li>`).join('')}</ul></div>`
    : '';
  const warningHtml = warnings.length
    ? `<div class="notice"><strong>Ristiriidat</strong><ul>${warnings.map((warning) => `<li>${esc(warning)}</li>`).join('')}</ul></div>`
    : '';
  const countFor = (prefix: keyof typeof BUSINESS_PROFILE_LIMITS, filled: number): number => Math.min(
    BUSINESS_PROFILE_LIMITS[prefix] * 2,
    Math.max(filled + 2, input.rowCounts?.[prefix] ?? 0),
  );
  const repeatTable = (
    prefix: keyof typeof BUSINESS_PROFILE_LIMITS,
    title: string,
    headings: string[],
    filled: number,
    row: (index: number, blank?: boolean) => string,
  ): string => {
    const rows = Array.from({ length: countFor(prefix, filled) }, (_, index) => row(index)).join('');
    return `<section data-repeat="${escAttr(prefix)}"><h2>${esc(title)}</h2><div class="table-wrap"><table><thead><tr>${headings.map((heading) => `<th>${esc(heading)}</th>`).join('')}<th>Toiminnot</th></tr></thead><tbody data-repeat-rows>${rows}</tbody></table></div><template>${row(0, true)}</template><div class="repeat-actions"><button class="secondary" type="submit" name="add_rows" value="${escAttr(prefix)}" data-repeat-add>Lisää rivejä</button></div></section>`;
  };
  const hourRow = (index: number, blank = false): string => {
    const row = blank ? undefined : profile.hours[index];
    return `<tr data-repeat-row><td><input aria-label="Päivä ${index + 1}" name="hours_${index}_label" value="${escAttr(row?.label ?? '')}"></td><td><input aria-label="Aukeaa ${index + 1}" name="hours_${index}_open" value="${escAttr(row?.open ?? '')}" placeholder="09:00"></td><td><input aria-label="Sulkeutuu ${index + 1}" name="hours_${index}_close" value="${escAttr(row?.close ?? '')}" placeholder="17:00"></td><td><input aria-label="Suljettu ${index + 1}" name="hours_${index}_closed" type="checkbox"${row?.closed ? ' checked' : ''}></td><td><button class="repeat-remove" type="button" data-repeat-remove>Poista</button></td></tr>`;
  };
  const exceptionRow = (index: number, blank = false): string => {
    const row = blank ? undefined : profile.exceptions?.[index];
    return `<tr data-repeat-row><td><input aria-label="Poikkeuspäivä ${index + 1}" name="exceptions_${index}_date" value="${escAttr(row?.date ?? '')}" placeholder="24.12."></td><td><input aria-label="Poikkeusaukiolo ${index + 1}" name="exceptions_${index}_text" value="${escAttr(row?.text ?? '')}" placeholder="suljettu"></td><td><button class="repeat-remove" type="button" data-repeat-remove>Poista</button></td></tr>`;
  };
  const itemTable = (prefix: 'services' | 'menu', title: string): string => {
    const items = profile[prefix];
    const row = (index: number, blank = false): string => {
      const item = blank ? undefined : items[index];
      return `<tr data-repeat-row><td><input aria-label="${escAttr(title)} nimi ${index + 1}" name="${prefix}_${index}_name" value="${escAttr(item?.name ?? '')}"></td><td><input aria-label="${escAttr(title)} ryhmä ${index + 1}" name="${prefix}_${index}_group" value="${escAttr(item?.group ?? '')}"></td><td><input aria-label="${escAttr(title)} hinta ${index + 1}" name="${prefix}_${index}_price" value="${escAttr(item?.price ?? '')}" placeholder="35 €"></td><td><textarea aria-label="${escAttr(title)} kuvaus ${index + 1}" name="${prefix}_${index}_desc">${esc(item?.desc ?? '')}</textarea></td><td><button class="repeat-remove" type="button" data-repeat-remove>Poista</button></td></tr>`;
    };
    return repeatTable(prefix, title, ['Nimi', 'Ryhmä', 'Hinta', 'Kuvaus'], items.length, row);
  };
  const linkKinds = ['', 'website', 'phone', 'instagram', 'facebook', 'linkedin', 'youtube', 'github', 'x', 'email'];
  const linkRow = (index: number, blank = false): string => {
    const link = blank ? undefined : profile.links[index];
    return `<tr data-repeat-row><td><input aria-label="Linkin nimi ${index + 1}" name="links_${index}_label" value="${escAttr(link?.label ?? '')}"></td><td><input aria-label="Linkin URL ${index + 1}" name="links_${index}_url" type="url" value="${escAttr(link?.url ?? '')}" placeholder="https://"></td><td><select aria-label="Linkin tyyppi ${index + 1}" name="links_${index}_kind">${linkKinds.map((kind) => `<option value="${escAttr(kind)}"${kind === (link?.kind ?? '') ? ' selected' : ''}>${esc(kind || 'Automaattinen')}</option>`).join('')}</select></td><td><button class="repeat-remove" type="button" data-repeat-remove>Poista</button></td></tr>`;
  };
  const vertical = profile.identity.vertical;
  const address = profile.contact.address;
  const verticalGroup = verticalGroupFor(vertical?.code ?? prospect.vertical, vertical?.label);
  const servicesBlock = itemTable('services', 'Palvelut');
  const menuBlock = itemTable('menu', 'Ruokalista');
  const itemBlocks = verticalGroup === 'food'
    ? `${menuBlock}<details><summary>Näytä myös Palvelut</summary>${servicesBlock}</details>`
    : verticalGroup === 'appearance' || verticalGroup === 'repair'
      ? `${servicesBlock}<details><summary>Näytä myös Ruokalista</summary>${menuBlock}</details>`
      : `${servicesBlock}${menuBlock}`;
  const photosBlock = profile.photos.length
    ? `<section class="card"><h2>Kuvat</h2><ul>${profile.photos.map((photo, index) => `<li><code>${esc(photo.src)}</code><input type="hidden" name="photos_${index}_src" value="${escAttr(photo.src)}"></li>`).join('')}</ul></section>`
    : `<section class="card"><h2>Kuvat</h2><p class="muted">${input.hasSite ? 'Kuvat lisätään sivustonäkymässä.' : 'Kuvat lisätään sivustonäkymässä sivuston luonnin jälkeen.'}</p></section>`;
  return layout(`Intake: ${prospect.name}`, `<p><a href="/admin/prospects/${escAttr(prospect.publicId)}">← ${esc(prospect.name)}</a></p><h1>BusinessProfile intake</h1>${errorHtml}${warningHtml}
    <form class="stack" action="/admin/prospects/${escAttr(prospect.publicId)}/intake" method="post">${formToken(csrf)}
      <section class="card"><h2>Identiteetti</h2><div class="fields">${valueField('Nimi *', 'name', profile.identity.name)}${valueField('Y-tunnus', 'yTunnus', profile.identity.yTunnus)}${valueField('Toimialakoodi', 'vertical_code', vertical?.code)}${valueField('Toimialan nimi', 'vertical_label', vertical?.label)}</div></section>
      <section class="card"><h2>Yhteystiedot</h2><div class="fields">${valueField('Puhelin', 'phone', profile.contact.phone)}${valueField('Sähköposti', 'email', profile.contact.email, 'email')}${valueField('Katuosoite', 'street', address?.street)}${valueField('Postinumero', 'postal', address?.postal)}${valueField('Kaupunki', 'city', address?.city)}</div></section>
      ${repeatTable('hours', 'Aukioloajat', ['Päivä', 'Aukeaa', 'Sulkeutuu', 'Suljettu'], profile.hours.length, hourRow)}
      ${repeatTable('exceptions', 'Poikkeusaukiolot', ['Päivä', 'Teksti'], profile.exceptions?.length ?? 0, exceptionRow)}
      ${itemBlocks}
      <section class="card"><h2>Tekstit</h2><label>Iskulause<textarea name="tagline">${esc(profile.tagline ?? '')}</textarea></label><label>Esittely<textarea name="about">${esc(profile.about ?? '')}</textarea></label></section>
      ${photosBlock}
      ${repeatTable('links', 'Linkit', ['Nimi', 'HTTPS-URL', 'Tyyppi'], profile.links.length, linkRow)}
      <section class="card stack"><h2>Suostumus</h2><label><span><input name="consent_photos" type="checkbox"${profile.consent.photos ? ' checked' : ''}> Kuvien käyttö vahvistettu</span></label><label><span><input name="consent_texts" type="checkbox"${profile.consent.texts ? ' checked' : ''}> Tekstien käyttö vahvistettu</span></label><label>Huomio<textarea name="consent_note">${esc(profile.consent.note ?? '')}</textarea></label></section>
      <div><button type="submit">Tallenna BusinessProfile</button></div>
    </form>`, csrf);
}

export function sitesPage(sites: SiteListItem[], csrf: string): string {
  const rows = sites.map((site) => `<tr><td><a href="/admin/sites/${escAttr(site.publicId)}">${esc(site.publicId)}</a></td><td><a href="/admin/sites/${escAttr(site.publicId)}">${esc(site.data.name)}</a></td><td>${badge(site.status)}</td><td>${esc(String(site.currentVersion))}</td><td>${esc(String(site.openProposalCount))}</td><td><a href="/b/${escAttr(site.publicId)}">Julkaistu</a></td></tr>`).join('');
  const table = rows ? `<div class="table-wrap"><table><thead><tr><th>ID</th><th>Nimi</th><th>Tila</th><th>Versio</th><th>Avoimet ehdotukset</th><th>Linkit</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted">Ei sivustoja.</p>';
  return layout('Sivustot', `<h1>Sivustot</h1>${table}`, csrf);
}

export function claimsPage(
  claims: Claim[],
  csrf: string,
  selected?: ClaimStatus,
  error?: string,
): string {
  const filters = [
    `<a${selected === undefined ? ' class="active"' : ''} href="/admin/claims">Kaikki</a>`,
    ...CLAIM_STATUSES.map((status) => `<a${selected === status ? ' class="active"' : ''} href="/admin/claims?status=${escAttr(status)}">${esc(status)}</a>`),
  ].join('');
  const rows = claims.map((claim) => `<tr><td>${esc(String(claim.id))}</td><td>${formatTime(claim.createdAt)}</td><td><a href="/admin/sites/${escAttr(claim.sitePublicId)}">${esc(claim.siteName)}<br><span class="muted">${esc(claim.sitePublicId)}</span></a></td><td>${esc(claim.name)}<br><a href="mailto:${escAttr(claim.email)}">${esc(claim.email)}</a><br>${esc(claim.phone ?? '—')}</td><td>${esc(claim.domainWish ?? '—')}</td><td>${esc(claim.message ?? '')}</td><td>${badge(claim.status)}</td><td>${claim.orderPublicId === undefined ? '—' : `${esc(claim.orderPublicId)}<br>${claim.orderStatus === undefined ? '' : orderBadge(claim.orderStatus)}`}</td></tr>`).join('');
  const table = rows
    ? `<div class="table-wrap"><table><thead><tr><th>ID</th><th>Luotu</th><th>Sivusto</th><th>Yhteystiedot</th><th>Verkkotunnus</th><th>Viesti</th><th>Tila</th><th>Tilaus</th></tr></thead><tbody>${rows}</tbody></table></div>`
    : '<p class="muted">Ei varauksia.</p>';
  const message = error === undefined ? '' : `<p class="notice error" role="alert">${esc(error)}</p>`;
  return layout('Varaukset', `<h1>Varaukset</h1>${message}<div class="filters">${filters}</div>${table}`, csrf);
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
  photos: PhotoMeta[];
  events: AuditEventRecord[];
  tokens: PreviewToken[];
  panelTokens: PanelToken[];
  updateRequests: UpdateRequest[];
  comments: DraftComment[];
  qaRun?: QaRun;
  checklist: LaunchChecklistRecord[];
  publishGateMessage: string;
  order?: Order;
  claim?: Claim;
  billingEvents: BillingEvent[];
  provisioningRun?: ProvisioningRun;
  provisioningSteps: ProvisioningStep[];
  renewals: Renewal[];
  csrf: string;
  error?: string;
}): string {
  const {
    site, versions, proposals, photos, events, tokens, panelTokens, updateRequests, comments,
    qaRun, checklist, publishGateMessage, order, claim, billingEvents,
    provisioningRun, provisioningSteps, renewals, csrf, error,
  } = input;
  const message = error === undefined ? '' : `<p class="notice error" role="alert">${esc(error)}</p>`;
  const proposalHtml = proposals.map((proposal) => {
    const summary = proposal.summary.length ? `<ul class="summary">${proposal.summary.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : '<p class="muted">Ei yhteenvetoa.</p>';
    return `<div class="proposal"><strong>${esc(proposal.proposalId)}</strong> · ${formatTime(proposal.at)} · <a href="/p/${escAttr(site.publicId)}/${escAttr(proposal.proposalId)}">Esikatselu</a>${summary}<div class="actions"><form action="/admin/sites/${escAttr(site.publicId)}/proposals/${escAttr(proposal.proposalId)}/approve" method="post">${formToken(csrf)}<button type="submit">Hyväksy</button></form><form action="/admin/sites/${escAttr(site.publicId)}/proposals/${escAttr(proposal.proposalId)}/reject" method="post">${formToken(csrf)}<button class="danger" type="submit">Hylkää</button></form></div></div>`;
  }).join('') || '<p class="muted">Ei avoimia ehdotuksia.</p>';
  const publishForm = (n: number): string => `<form class="stack" action="/admin/sites/${escAttr(site.publicId)}/publish" method="post">${formToken(csrf)}<input type="hidden" name="n" value="${escAttr(String(n))}"><button type="submit">Julkaise versio ${esc(String(n))}</button><details><summary>Operaattorin ohitus</summary><label><span><input name="override" type="checkbox" value="true"> Ohita julkaisuportti</span></label><label>Syy<input name="reason"></label></details></form>`;
  const versionRows = (items: SnapshotMeta[]): string => items.map((version) => `<tr><td>${esc(String(version.n))}</td><td>${formatTime(version.at)}</td><td>${esc(version.note ?? '')}</td><td><div class="actions"><form action="/admin/sites/${escAttr(site.publicId)}/rollback" method="post">${formToken(csrf)}<input type="hidden" name="to" value="${escAttr(String(version.n))}"><button class="secondary" type="submit">Palauta</button></form>${publishForm(version.n)}</div></td></tr>`).join('');
  const versionTableFor = (items: SnapshotMeta[]): string => `<div class="table-wrap"><table><thead><tr><th>n</th><th>Aika</th><th>Huomio</th><th></th></tr></thead><tbody>${versionRows(items)}</tbody></table></div>`;
  const newestVersions = versions.slice(0, 5);
  const olderVersions = versions.slice(5);
  const versionTable = versions.length
    ? `${versionTableFor(newestVersions)}${olderVersions.length ? `<details><summary>Vanhemmat versiot (${olderVersions.length})</summary>${versionTableFor(olderVersions)}</details>` : ''}`
    : '<p class="muted">Ei aiempia versioita.</p>';
  const tokenRows = tokens.map((token) => `<tr><td>${esc(token.label)}</td><td>${esc(token.proposalPublicId ?? 'Koko sivusto')}</td><td>${formatTime(token.expiresAt)}</td><td><form action="/admin/sites/${escAttr(site.publicId)}/tokens/${escAttr(String(token.id))}/revoke" method="post">${formToken(csrf)}<button class="danger" type="submit">Peru</button></form></td></tr>`).join('');
  const tokenTable = tokenRows ? `<div class="table-wrap"><table><thead><tr><th>Nimi</th><th>Rajaus</th><th>Vanhenee</th><th></th></tr></thead><tbody>${tokenRows}</tbody></table></div>` : '<p class="muted">Ei aktiivisia esikatselulinkkejä.</p>';
  const panelTokenRows = panelTokens.map((token) => `<tr><td>${formatTime(token.createdAt)}</td><td>${formatTime(token.expiresAt)}</td><td><form action="/admin/sites/${escAttr(site.publicId)}/panel-tokens/${escAttr(String(token.id))}/revoke" method="post">${formToken(csrf)}<button class="danger" type="submit">Peru</button></form></td></tr>`).join('');
  const panelTokenTable = panelTokenRows ? `<div class="table-wrap"><table><thead><tr><th>Luotu</th><th>Vanhenee</th><th></th></tr></thead><tbody>${panelTokenRows}</tbody></table></div>` : '<p class="muted">Ei aktiivisia asiakaspaneelilinkkejä.</p>';
  const updateRows = updateRequests.map((entry) => {
    const linked = entry.proposalPublicId === undefined
      ? undefined
      : proposals.find((proposal) => proposal.proposalId === entry.proposalPublicId);
    const summary = linked?.summary.length
      ? `<ul class="summary">${linked.summary.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`
      : entry.channel === 'email'
        ? `<p>${esc(entry.body.length > 120 ? `${entry.body.slice(0, 120)}…` : entry.body)}</p>`
        : '<p class="muted">Ei yhteenvetoa.</p>';
    return `<tr><td><a href="/admin/updates">${esc(String(entry.id))}</a></td><td>${formatTime(entry.createdAt)}</td><td>${esc(entry.fromAddr ?? '—')}</td><td>${badge(entry.status)}</td><td>${badge(entry.channel)}${entry.subject ? ` <strong>${esc(entry.subject)}</strong>` : ''}${summary}<details><summary>Raaka</summary><pre>${esc(entry.body)}</pre></details></td></tr>`;
  }).join('');
  const updateTable = updateRows ? `<div class="table-wrap"><table><thead><tr><th>ID</th><th>Aika</th><th>Lähettäjä</th><th>Tila</th><th>Sisältö</th></tr></thead><tbody>${updateRows}</tbody></table></div>` : '<p class="muted">Ei avoimia päivityspyyntöjä.</p>';
  const proposalOptions = proposals.map((proposal) => `<option value="${escAttr(proposal.proposalId)}">${esc(proposal.proposalId)}</option>`).join('');
  const commentRows = comments.map((comment) => `<tr><td>${formatTime(comment.createdAt)}</td><td>${comment.proposalPublicId === undefined ? 'Koko sivusto' : `<a href="/p/${escAttr(site.publicId)}/${escAttr(comment.proposalPublicId)}">${esc(comment.proposalPublicId)}</a>`}</td><td>${esc(comment.author)}</td><td>${esc(comment.body)}</td></tr>`).join('');
  const commentTable = commentRows ? `<div class="table-wrap"><table><thead><tr><th>Aika</th><th>Ehdotus</th><th>Kirjoittaja</th><th>Kommentti</th></tr></thead><tbody>${commentRows}</tbody></table></div>` : '<p class="muted">Ei kommentteja.</p>';
  const orderDetails = order === undefined
    ? '<p class="muted">Ei tilausta.</p>'
    : `<dl class="definition"><dt>Tila</dt><dd>${orderBadge(order.status)}</dd><dt>Tilaus-ID</dt><dd>${esc(order.publicId)}</dd><dt>Palveluntarjoaja</dt><dd>${esc(order.provider)}</dd><dt>Hinta</dt><dd>${esc((order.amountBuildCents / 100).toFixed(2))} € + ${esc((order.amountMonthlyCents / 100).toFixed(2))} €/kk</dd></dl>`;
  const billingRows = billingEvents.map((event) => `<tr><td>${formatTime(event.createdAt)}</td><td>${esc(event.type)}</td><td><code>${esc(event.payload.length > 300 ? `${event.payload.slice(0, 300)}…` : event.payload)}</code></td></tr>`).join('');
  const billingTable = billingRows
    ? `<div class="table-wrap"><table><thead><tr><th>Aika</th><th>Tyyppi</th><th>Raakatapahtuma</th></tr></thead><tbody>${billingRows}</tbody></table></div>`
    : '<p class="muted">Ei laskutustapahtumia.</p>';
  const orderBlock = `${orderDetails}<form action="/admin/sites/${escAttr(site.publicId)}/order" method="post">${formToken(csrf)}<button type="submit">Luo tilaus</button></form><details${billingEvents.length <= 5 ? ' open' : ''}><summary>Laskutustapahtumat</summary>${billingTable}</details>`;
  const claimBlock = claim === undefined
    ? '<p class="muted">Ei varausta.</p>'
    : `<dl class="definition"><dt>Tila</dt><dd>${badge(claim.status)}</dd><dt>Nimi</dt><dd>${esc(claim.name)}</dd><dt>Sähköposti</dt><dd>${esc(claim.email)}</dd><dt>Puhelin</dt><dd>${esc(claim.phone ?? '—')}</dd><dt>Verkkotunnustoive</dt><dd>${esc(claim.domainWish ?? '—')}</dd><dt>Viesti</dt><dd>${esc(claim.message ?? '—')}</dd><dt>Luotu</dt><dd>${formatTime(claim.createdAt)}</dd></dl>`;
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
  const newProvisioningForm = `<form class="card stack" action="/admin/sites/${escAttr(site.publicId)}/provisioning/start" method="post">${formToken(csrf)}<label>Verkkotunnus *<input name="domain" required maxlength="72" pattern="^[a-z0-9][a-z0-9.-]{2,60}\\.[a-z]{2,10}$" placeholder="yritys.fi"></label><div><button type="submit">Aloita provisiointi</button></div></form>`;
  const provisioningHeader = provisioningRun === undefined
    ? ''
    : `<dl class="definition"><dt>Ajo</dt><dd>${esc(provisioningRun.publicId)}</dd><dt>Verkkotunnus</dt><dd>${esc(provisioningRun.domain)}</dd><dt>Tila</dt><dd>${badge(provisioningRun.status)}</dd></dl>${provisioningRun.status === 'kaynnissa' ? `<form action="/admin/sites/${escAttr(site.publicId)}/provisioning/abort" method="post">${formToken(csrf)}<button class="danger" type="submit">Keskeytä provisiointi</button></form>` : ''}`;
  const provisioningNew = provisioningRun?.status === 'kaynnissa' || provisioningRun?.status === 'valmis'
    ? `<details><summary>Uusi provisiointi</summary>${newProvisioningForm}</details>`
    : newProvisioningForm;
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
    return `<label><span><input name="${escAttr(item.id)}" type="checkbox" value="true"${checked ? ' checked' : ''}> ${esc(item.label)}</span></label>`;
  }).join('');
  const checklistForm = `<form class="card stack" action="/admin/sites/${escAttr(site.publicId)}/checklist" method="post">${formToken(csrf)}${checklistHtml}<div><button class="secondary" type="submit">Tallenna</button></div></form>`;
  const gateHint = publishGateMessage ? `<p class="notice">Julkaisuportti ei täyty. ${esc(publishGateMessage)}</p>` : '<p class="notice">Julkaisun ehdot täyttyvät.</p>';
  const publishControls = `${gateHint}<div class="actions">${publishForm(site.currentVersion)}${site.publishedVersion === undefined ? '' : `<form action="/admin/sites/${escAttr(site.publicId)}/unpublish" method="post">${formToken(csrf)}<button class="danger" type="submit">Poista julkaisu</button></form>`}</div>`;
  const offboardingControls = site.status === 'archived'
    ? `<div class="actions"><form action="/admin/sites/${escAttr(site.publicId)}/restore" method="post">${formToken(csrf)}<button type="submit">Palauta</button></form></div>
      <form class="card stack" action="/admin/sites/${escAttr(site.publicId)}/delete" method="post">${formToken(csrf)}<h3>Poista pysyvästi</h3><p class="notice error">Tätä ei voi perua. Kirjoita sivuston ID vahvistukseksi.</p><label>Vahvista ID <input name="confirm" required autocomplete="off" pattern="${escAttr(site.publicId)}"></label><div><button class="danger" type="submit">Poista pysyvästi</button></div></form>`
    : `<form class="card stack" action="/admin/sites/${escAttr(site.publicId)}/archive" method="post">${formToken(csrf)}<h3>Arkistoi</h3><label><span><input name="confirm" type="checkbox" value="true" required> Vahvistan arkistoinnin ja asiakaslinkkien sulkemisen</span></label><div><button class="danger" type="submit">Arkistoi</button></div></form>`;
  const photoRows = photos.map((photo) => {
    const path = `/${photo.r2Key.replace(/^photos\//, 'img/')}`;
    return `<li><a href="${escAttr(path)}"><code>${esc(path)}</code></a> <span class="muted">${esc(photo.contentType)}, ${esc(String(photo.bytes))} tavua</span></li>`;
  }).join('');
  const photoBlock = `<div id="photos"><h3>Kuvat</h3><form class="card stack" action="/admin/sites/${escAttr(site.publicId)}/photos" method="post" enctype="multipart/form-data">${formToken(csrf)}<label>Kuvatiedosto<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required></label><div><button type="submit">Lataa kuva</button></div></form>${photoRows ? `<ul>${photoRows}</ul>` : '<p class="muted">Ei ladattuja kuvia.</p>'}<p class="muted">Kopioi /img/-polku ehdotukseen ja käytä sitä sivuston pääkuvassa tai galleriassa.</p></div>`;
  return layout(site.data.name, `<p><a href="/admin/sites">← Sivustot</a></p><h1>${esc(site.data.name)}</h1>${message}
    <nav class="anchor-nav" aria-label="Sivuston osiot"><a href="#yleiskuva">Yleiskuva</a><a href="#sisalto">Sisältö</a><a href="#kaupallinen">Kaupallinen</a><a href="#julkaisu">Julkaisu</a><a href="#loki">Loki</a></nav>
    <section id="yleiskuva"><h2>Yleiskuva</h2><dl class="definition"><dt>ID</dt><dd>${esc(site.publicId)}</dd><dt>Kuvaus</dt><dd>${esc(site.data.tagline ?? '—')}</dd><dt>Tila</dt><dd>${badge(site.status)}</dd><dt>Nykyinen versio</dt><dd>${esc(String(site.currentVersion))}</dd><dt>Julkaistu versio</dt><dd>${esc(site.publishedVersion === undefined ? '—' : String(site.publishedVersion))}</dd><dt>Kuvia</dt><dd>${esc(String(photos.length))}</dd><dt>Nykyisen esikatselu</dt><dd><a href="/p/${escAttr(site.publicId)}/current">/p/${esc(site.publicId)}/current</a></dd><dt>Luovutus</dt><dd><a href="/admin/sites/${escAttr(site.publicId)}/transfer">Siirron tarkistuslista</a> · <a href="/api/biz/sites/${escAttr(site.publicId)}/export">Export ZIP</a></dd></dl>${publishControls}${photoBlock}<h3>Arkistointi ja poisto</h3>${offboardingControls}</section>
    <section id="sisalto"><h2>Sisältö</h2><h3>Avoimet ehdotukset</h3><div class="card">${proposalHtml}</div><h3>Avoimet päivityspyynnöt</h3>${updateTable}<h3>Kommentit</h3>${commentTable}</section>
    <section id="kaupallinen"><h2>Kaupallinen</h2><h3>Varaus</h3>${claimBlock}<h3>Tilaus</h3>${orderBlock}<h3>Provisiointi</h3>${provisioningHeader}${provisioningTable}${provisioningNew}<h3>Uusinnat</h3>${renewalTable}</section>
    <section id="julkaisu"><h2>Julkaisu</h2><h3>QA</h3><form action="/admin/sites/${escAttr(site.publicId)}/qa" method="post">${formToken(csrf)}<button type="submit">Aja tarkistukset</button></form>${qaTable}<h3>Julkaisun tarkistuslista</h3>${checklistForm}<h3>Versiot</h3>${versionTable}<h3>Esikatselulinkit</h3>${tokenTable}<h4>Uusi esikatselulinkki</h4><form class="card fields" action="/admin/sites/${escAttr(site.publicId)}/tokens" method="post">${formToken(csrf)}<label>Nimi *<input name="label" required maxlength="100"></label><label>Voimassa päivää *<input name="days" type="number" min="1" max="60" value="14" required></label><label>Ehdotus (valinnainen)<select name="proposal"><option value="">Koko sivusto</option>${proposalOptions}</select></label><div class="actions"><button type="submit">Luo linkki</button></div></form><h3>Asiakaspaneelilinkit</h3>${panelTokenTable}<form class="card" action="/admin/sites/${escAttr(site.publicId)}/panel-tokens" method="post">${formToken(csrf)}<button type="submit">Luo 30 päivän paneelilinkki</button></form></section>
    <section id="loki"><h2>Loki</h2><details${events.length <= 5 ? ' open' : ''}><summary>Tapahtumat</summary>${auditTable(events)}</details></section>`, csrf);
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

export function transferPage(site: Site, domain?: string): string {
  const domainFact = domain ?? 'Ei provisiointitietoa';
  return `<!doctype html>
<html lang="fi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Siirron tarkistuslista · ${esc(site.data.name)}</title>
<style>:root{font-family:system-ui,sans-serif;line-height:1.5;color:#111}body{max-width:48rem;margin:2rem auto;padding:0 1rem}h1{margin-bottom:.25rem}.facts{border:1px solid #bbb;padding:1rem}li{margin:.7rem 0}.warning{border-left:.3rem solid #a12828;padding-left:1rem}@media print{body{max-width:none;margin:0}.screen-only{display:none}a{color:inherit;text-decoration:none}}</style>
</head><body><p class="screen-only"><a href="/admin/sites/${escAttr(site.publicId)}">← Takaisin sivustolle</a></p>
<h1>Siirron tarkistuslista</h1><p>${esc(site.data.name)}</p>
<dl class="facts"><dt>Sivuston ID</dt><dd>${esc(site.publicId)}</dd><dt>Verkkotunnus</dt><dd>${esc(domainFact)}</dd></dl>
<ol>
  <li><strong>Verkkotunnuksen siirron valtuutuskoodi:</strong> pyydä nykyiseltä välittäjältä siirtoavain ja toimita se uudelle välittäjälle. Poista siirtolukitus tarvittaessa.</li>
  <li><strong>DNS-tietueet:</strong> tallenna nykyiset tietueet, vaihda A/AAAA/CNAME-tietueet uuden palvelun ohjeen mukaan ja tarkista myös MX-, SPF-, DKIM- ja DMARC-tietueet.</li>
  <li><strong>Postilaatikoiden siirto:</strong> luo osoitteet uudelle palvelulle, kopioi vanhat viestit ja testaa lähetys sekä vastaanotto ennen vanhan palvelun sulkemista.</li>
  <li><strong>Sivuston tiedostot:</strong> lataa <a href="/api/biz/sites/${escAttr(site.publicId)}/export">export ZIP</a>, pura se ja siirrä sisältö uuden webhotellin julkaisemaan hakemistoon.</li>
  <li><strong>Lopputarkistus:</strong> testaa verkkotunnus, HTTPS, kuvat, puhelin- ja sähköpostilinkit sekä mobiilinäkymä.</li>
</ol>
<section class="warning"><h2>Mitä lakkaa toimimasta</h2><ul><li>Mikoshin ylläpitämä julkaisu ja renderöintivälimuisti.</li><li>Asiakaspaneeli- ja esikatselulinkit.</li><li>Mikoshin päivityspyyntöjen käsittely.</li><li>Hallitut verkkotunnus- ja postilaatikkouusinnat sekä niihin liittyvät muistutukset.</li></ul></section>
<p class="screen-only"><button onclick="print()">Tulosta tarkistuslista</button></p></body></html>`;
}

export function deletionsPage(
  entries: DeletionLogRecord[],
  csrf: string,
  nextBefore?: number,
): string {
  const rows = entries.map((entry) => `<tr><td>${esc(String(entry.id))}</td><td class="nowrap">${formatTime(entry.createdAt)}</td><td>${esc(entry.sitePublicId)}<br><span class="muted">sisäinen ${esc(String(entry.siteId))}</span></td><td>${esc(entry.item)}</td><td>${esc(entry.actor)}</td><td>${esc(entry.detail === undefined ? '' : JSON.stringify(entry.detail))}</td></tr>`).join('');
  const table = rows
    ? `<div class="table-wrap"><table><thead><tr><th>ID</th><th>Aika</th><th>Sivusto</th><th>Kohde</th><th>Toimija</th><th>Tiedot</th></tr></thead><tbody>${rows}</tbody></table></div>`
    : '<p class="muted">Ei poistotapahtumia.</p>';
  const next = nextBefore === undefined ? '' : `<p><a class="button" href="/admin/deletions?before=${escAttr(String(nextBefore))}">Vanhemmat tapahtumat →</a></p>`;
  return layout('Poistoloki', `<h1>Poistoloki</h1><p>Arkistoinnin, palautusten ja pysyvien poistojen säilyvä loki.</p>${table}${next}`, csrf);
}

export function messagePage(title: string, message: string, csrf: string): string {
  return layout(title, `<h1>${esc(title)}</h1><p class="notice error">${esc(message)}</p><p><a href="/admin">Dashboardille</a></p>`, csrf);
}
