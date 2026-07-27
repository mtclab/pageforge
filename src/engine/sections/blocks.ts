import { esc, escAttr, safeUrl, textToHtml } from '../escape.js';
import { obfuscatedEmailLink } from '../links.js';
import type { LabelContext } from '../localization.js';
import { telHref } from '../phone.js';
import { galleryPath, type Section, type SiteData } from '../types.js';

/**
 * All <main> section renderers. Each returns '' when the section has no
 * content, so empty sections never render. `idx` keys the aria-labelledby ids.
 * `ctx` carries the label set for the page's language and voice; `bizPath`
 * only switches business typography (drop caps), never the wording.
 */
export function renderSection(
  section: Section,
  idx: number,
  ctx: LabelContext,
  business?: SiteData['business'],
  bizPath = false,
): string {
  switch (section.kind) {
    case 'about':
      return renderAbout(section, idx, ctx, bizPath);
    case 'projects':
      return renderProjects(section, idx, ctx);
    case 'hobbies':
      return renderHobbies(section, idx, ctx);
    case 'contact':
      return renderContact(section, idx, ctx);
    case 'custom':
      return renderCustom(section, idx);
    case 'gallery':
      return renderGallery(section, idx, ctx);
    case 'hours':
      return renderHours(section, idx, ctx);
    case 'services':
      return renderServices(section, idx, ctx);
    case 'notice':
      return renderNotice(section, idx, ctx);
    case 'location':
      return renderLocation(section, idx, ctx, business);
  }
}

/**
 * `langAttr` marks headings WE generate when they are not in the page's own
 * language; a heading the user typed is in their language and always gets ''.
 */
function wrap(kind: string, idx: number, title: string, body: string, langAttr = ''): string {
  const id = `sec-${idx}-h`;
  return `<section class="section section-${kind}" aria-labelledby="${id}">
<h2 id="${id}"${langAttr}>${esc(title)}</h2>
${body}
</section>`;
}

function businessAboutToHtml(text: string): string {
  const normalized = text.replaceAll('\r\n', '\n').trim();
  const chars = [...normalized];
  const first = chars.shift();
  if (first === undefined) return '';
  const escaped = `<span class="initial-cap">${esc(first)}</span>${esc(chars.join(''))}`;
  return escaped
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replaceAll('\n', '<br>')}</p>`)
    .join('\n');
}

function renderAbout(
  s: Extract<Section, { kind: 'about' }>,
  idx: number,
  ctx: LabelContext,
  bizPath = false,
): string {
  const body = bizPath ? businessAboutToHtml(s.text) : textToHtml(s.text);
  if (!body) return '';
  const title = ctx.isBusiness ? ctx.business.about : ctx.personal.about;
  return wrap('about', idx, title, body, ctx.labelLangAttr);
}

function renderProjects(
  s: Extract<Section, { kind: 'projects' }>,
  idx: number,
  ctx: LabelContext,
): string {
  const items = s.items
    .filter((it) => it.name.trim())
    .map((it) => {
      const name = esc(it.name.trim());
      const url = it.url ? safeUrl(it.url) : null;
      const heading = url ? `<a href="${escAttr(url)}">${name}</a>` : name;
      const desc = it.desc?.trim() ? `\n<p class="desc">${esc(it.desc.trim())}</p>` : '';
      return `<li class="project"><h3>${heading}</h3>${desc}</li>`;
    });
  if (!items.length) return '';
  const custom = s.title?.trim();
  return wrap(
    'projects',
    idx,
    custom || ctx.personal.projects,
    `<ul class="projects">\n${items.join('\n')}\n</ul>`,
    custom ? '' : ctx.labelLangAttr,
  );
}

function renderHobbies(
  s: Extract<Section, { kind: 'hobbies' }>,
  idx: number,
  ctx: LabelContext,
): string {
  const items = s.items.filter((h) => h.trim()).map((h) => `<li>${esc(h.trim())}</li>`);
  if (!items.length) return '';
  const custom = s.title?.trim();
  return wrap(
    'hobbies',
    idx,
    custom || ctx.personal.hobbies,
    `<ul class="chips">\n${items.join('\n')}\n</ul>`,
    custom ? '' : ctx.labelLangAttr,
  );
}

function renderContact(
  s: Extract<Section, { kind: 'contact' }>,
  idx: number,
  ctx: LabelContext,
): string {
  const parts: string[] = [];
  if (s.email?.trim()) {
    const email = s.email.trim();
    const url = safeUrl(`mailto:${email}`);
    const label = ctx.isBusiness ? ctx.business.contact : ctx.personal.email;
    const link = url ? obfuscatedEmailLink(url, label, '', ctx.labelLangAttr) : '';
    if (link) parts.push(`<p>${link}</p>`);
  }
  if (s.note?.trim()) parts.push(textToHtml(s.note));
  if (!parts.length) return '';
  const title = ctx.isBusiness ? ctx.business.contact : ctx.personal.contact;
  return wrap('contact', idx, title, parts.join('\n'), ctx.labelLangAttr);
}

function renderGallery(
  s: Extract<Section, { kind: 'gallery' }>,
  idx: number,
  ctx: LabelContext,
): string {
  const items = s.photos.map(
    (photo, j) => {
      const src = 'src' in photo ? escAttr(photo.src) : galleryPath(idx, j);
      // A described photo carries its description; one the author left blank
      // stays alt="" so screen readers skip it instead of reading a filename.
      const alt = escAttr(photo.alt?.trim() ?? '');
      return `<li><img src="${src}" alt="${alt}" loading="lazy"></li>`;
    },
  );
  if (!items.length) return '';
  const custom = s.title?.trim();
  const label = ctx.isBusiness ? ctx.business.gallery : ctx.personal.gallery;
  return wrap(
    'gallery',
    idx,
    custom || label,
    `<ul class="gallery">\n${items.join('\n')}\n</ul>`,
    custom ? '' : ctx.labelLangAttr,
  );
}

function renderCustom(s: Extract<Section, { kind: 'custom' }>, idx: number): string {
  const body = textToHtml(s.text);
  if (!body || !s.title.trim()) return '';
  return wrap('custom', idx, s.title.trim(), body);
}

function renderHours(
  s: Extract<Section, { kind: 'hours' }>,
  idx: number,
  ctx: LabelContext,
): string {
  const labels = ctx.business;
  const days = s.days
    .filter((day) => day.label.trim())
    .map((day) => {
      let value = '';
      let valueLang = '';
      if (day.closed) {
        value = labels.closed;
        valueLang = ctx.labelLangAttr;
      } else if (day.open?.trim() && day.close?.trim()) {
        value = `${day.open.trim()}–${day.close.trim()}`;
      } else {
        value = day.open?.trim() || day.close?.trim() || '';
      }
      return `<div class="hours-row"><dt>${esc(day.label.trim())}</dt><dd${valueLang}>${esc(value)}</dd></div>`;
    });
  const exceptions = (s.exceptions ?? [])
    .filter((exception) => exception.date.trim() || exception.text.trim())
    .map(
      (exception) =>
        `<li><strong>${esc(exception.date.trim())}</strong> ${esc(exception.text.trim())}</li>`,
    );
  if (!days.length && !exceptions.length) return '';
  const exceptionList = exceptions.length
    ? `\n<h3${ctx.labelLangAttr}>${labels.exceptions}</h3>\n<ul class="hours-exceptions">\n${exceptions.join('\n')}\n</ul>`
    : '';
  const custom = s.title?.trim();
  return wrap(
    'hours',
    idx,
    custom || labels.hours,
    `<dl class="hours-list">\n${days.join('\n')}\n</dl>${exceptionList}`,
    custom ? '' : ctx.labelLangAttr,
  );
}

function renderServices(
  s: Extract<Section, { kind: 'services' }>,
  idx: number,
  ctx: LabelContext,
): string {
  const items = s.items
    .filter((item) => item.name.trim())
    .map((item) => {
      const desc = item.desc?.trim() ? `\n<p class="desc">${esc(item.desc.trim())}</p>` : '';
      const price = item.price?.trim() ? `\n<p class="service-price">${esc(item.price.trim())}</p>` : '';
      return {
        group: item.group?.trim() ?? '',
        name: esc(item.name.trim()),
        rest: `${desc}${price}`,
      };
    });
  if (!items.length) return '';
  const lists: string[] = [];
  let group: string | undefined;
  let current: typeof items = [];
  const flush = (): void => {
    if (!current.length) return;
    // A group heading owns the services under it, so those services sit one
    // level deeper: h2 section > h3 group > h4 service. Ungrouped lists keep
    // their services directly under the section heading, at h3.
    const level = group ? 4 : 3;
    const heading = group ? `<h3 class="service-group">${esc(group)}</h3>\n` : '';
    const rendered = current.map(
      (item) => `<li class="service"><h${level}>${item.name}</h${level}>${item.rest}</li>`,
    );
    lists.push(`${heading}<ul class="services menu-board">\n${rendered.join('\n')}\n</ul>`);
    current = [];
  };
  for (const item of items) {
    if (group !== undefined && item.group !== group) flush();
    group = item.group;
    current.push(item);
  }
  flush();
  const custom = s.title?.trim();
  return wrap(
    'services',
    idx,
    custom || ctx.business.services,
    lists.join('\n'),
    custom ? '' : ctx.labelLangAttr,
  );
}

function renderNotice(
  s: Extract<Section, { kind: 'notice' }>,
  idx: number,
  ctx: LabelContext,
): string {
  const text = s.text.trim();
  if (!text) return '';
  const until = s.until?.trim() ? ` <span class="notice-until">${esc(s.until.trim())}</span>` : '';
  const id = `sec-${idx}-h`;
  const custom = s.title?.trim();
  const langAttr = custom ? '' : ctx.labelLangAttr;
  return `<section class="section section-notice" role="status" aria-labelledby="${id}">
<h2 id="${id}"${langAttr}>${esc(custom || ctx.business.notice)}</h2>
<p>${esc(text)}${until}</p>
</section>`;
}

function renderLocation(
  s: Extract<Section, { kind: 'location' }>,
  idx: number,
  ctx: LabelContext,
  business?: SiteData['business'],
): string {
  const labels = ctx.business;
  const address = s.address?.trim() || business?.address?.trim();
  const phone = s.phone?.trim() || business?.phone?.trim();
  const parts: string[] = [];
  if (address) parts.push(`<p class="location-address">${esc(address)}</p>`);
  if (phone) parts.push(`<p><a href="${escAttr(telHref(phone))}">${esc(phone)}</a></p>`);
  const mapUrl = s.mapUrl ? safeUrl(s.mapUrl) : null;
  if (mapUrl && /^https?:/.test(mapUrl)) {
    parts.push(`<p><a href="${escAttr(mapUrl)}"${ctx.labelLangAttr}>${labels.map}</a></p>`);
  }
  if (!parts.length) return '';
  const custom = s.title?.trim();
  return wrap(
    'location',
    idx,
    custom || labels.location,
    parts.join('\n'),
    custom ? '' : ctx.labelLangAttr,
  );
}
