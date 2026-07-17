import { esc, escAttr, safeUrl, textToHtml } from '../escape.js';
import { obfuscatedEmailLink } from '../links.js';
import { businessLabels } from '../localization.js';
import { telHref } from '../phone.js';
import { galleryPath, type Section, type SiteData } from '../types.js';

/**
 * All <main> section renderers. Each returns '' when the section has no
 * content, so empty sections never render. `idx` keys the aria-labelledby ids.
 */
export function renderSection(
  section: Section,
  idx: number,
  lang?: string,
  business?: SiteData['business'],
): string {
  switch (section.kind) {
    case 'about':
      return renderAbout(section, idx);
    case 'projects':
      return renderProjects(section, idx);
    case 'hobbies':
      return renderHobbies(section, idx);
    case 'contact':
      return renderContact(section, idx, lang);
    case 'custom':
      return renderCustom(section, idx);
    case 'gallery':
      return renderGallery(section, idx, lang);
    case 'hours':
      return renderHours(section, idx, lang);
    case 'services':
      return renderServices(section, idx, lang);
    case 'notice':
      return renderNotice(section, idx, lang);
    case 'location':
      return renderLocation(section, idx, lang, business);
  }
}

function wrap(kind: string, idx: number, title: string, body: string): string {
  const id = `sec-${idx}-h`;
  return `<section class="section section-${kind}" aria-labelledby="${id}">
<h2 id="${id}">${esc(title)}</h2>
${body}
</section>`;
}

function renderAbout(s: Extract<Section, { kind: 'about' }>, idx: number): string {
  const body = textToHtml(s.text);
  if (!body) return '';
  return wrap('about', idx, 'About', body);
}

function renderProjects(s: Extract<Section, { kind: 'projects' }>, idx: number): string {
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
  return wrap('projects', idx, s.title?.trim() || 'Things I make', `<ul class="projects">\n${items.join('\n')}\n</ul>`);
}

function renderHobbies(s: Extract<Section, { kind: 'hobbies' }>, idx: number): string {
  const items = s.items.filter((h) => h.trim()).map((h) => `<li>${esc(h.trim())}</li>`);
  if (!items.length) return '';
  return wrap('hobbies', idx, s.title?.trim() || 'Things I love', `<ul class="chips">\n${items.join('\n')}\n</ul>`);
}

function renderContact(s: Extract<Section, { kind: 'contact' }>, idx: number, lang?: string): string {
  const parts: string[] = [];
  if (s.email?.trim()) {
    const email = s.email.trim();
    const url = safeUrl(`mailto:${email}`);
    const link = url ? obfuscatedEmailLink(url, 'Email me') : '';
    if (link) parts.push(`<p>${link}</p>`);
  }
  if (s.note?.trim()) parts.push(textToHtml(s.note));
  if (!parts.length) return '';
  return wrap('contact', idx, businessLabels(lang).contact, parts.join('\n'));
}

function renderGallery(s: Extract<Section, { kind: 'gallery' }>, idx: number, lang?: string): string {
  const items = s.photos.map(
    (photo, j) => {
      const src = 'src' in photo ? escAttr(photo.src) : galleryPath(idx, j);
      return `<li><img src="${src}" alt="" loading="lazy"></li>`;
    },
  );
  if (!items.length) return '';
  return wrap('gallery', idx, s.title?.trim() || businessLabels(lang).gallery, `<ul class="gallery">\n${items.join('\n')}\n</ul>`);
}

function renderCustom(s: Extract<Section, { kind: 'custom' }>, idx: number): string {
  const body = textToHtml(s.text);
  if (!body || !s.title.trim()) return '';
  return wrap('custom', idx, s.title.trim(), body);
}

function renderHours(s: Extract<Section, { kind: 'hours' }>, idx: number, lang?: string): string {
  const labels = businessLabels(lang);
  const days = s.days
    .filter((day) => day.label.trim())
    .map((day) => {
      let value = '';
      if (day.closed) {
        value = labels.closed;
      } else if (day.open?.trim() && day.close?.trim()) {
        value = `${day.open.trim()}–${day.close.trim()}`;
      } else {
        value = day.open?.trim() || day.close?.trim() || '';
      }
      return `<div class="hours-row"><dt>${esc(day.label.trim())}</dt><dd>${esc(value)}</dd></div>`;
    });
  const exceptions = (s.exceptions ?? [])
    .filter((exception) => exception.date.trim() || exception.text.trim())
    .map(
      (exception) =>
        `<li><strong>${esc(exception.date.trim())}</strong> ${esc(exception.text.trim())}</li>`,
    );
  if (!days.length && !exceptions.length) return '';
  const exceptionList = exceptions.length
    ? `\n<h3>${labels.exceptions}</h3>\n<ul class="hours-exceptions">\n${exceptions.join('\n')}\n</ul>`
    : '';
  return wrap(
    'hours',
    idx,
    s.title?.trim() || labels.hours,
    `<dl class="hours-list">\n${days.join('\n')}\n</dl>${exceptionList}`,
  );
}

function renderServices(s: Extract<Section, { kind: 'services' }>, idx: number, lang?: string): string {
  const items = s.items
    .filter((item) => item.name.trim())
    .map((item) => {
      const desc = item.desc?.trim() ? `\n<p class="desc">${esc(item.desc.trim())}</p>` : '';
      const price = item.price?.trim() ? `\n<p class="service-price">${esc(item.price.trim())}</p>` : '';
      return `<li class="service"><h3>${esc(item.name.trim())}</h3>${desc}${price}</li>`;
    });
  if (!items.length) return '';
  return wrap(
    'services',
    idx,
    s.title?.trim() || businessLabels(lang).services,
    `<ul class="services">\n${items.join('\n')}\n</ul>`,
  );
}

function renderNotice(s: Extract<Section, { kind: 'notice' }>, idx: number, lang?: string): string {
  const text = s.text.trim();
  if (!text) return '';
  const until = s.until?.trim() ? ` <span class="notice-until">${esc(s.until.trim())}</span>` : '';
  const id = `sec-${idx}-h`;
  return `<section class="section section-notice" role="status" aria-labelledby="${id}">
<h2 id="${id}">${esc(s.title?.trim() || businessLabels(lang).notice)}</h2>
<p>${esc(text)}${until}</p>
</section>`;
}

function renderLocation(
  s: Extract<Section, { kind: 'location' }>,
  idx: number,
  lang?: string,
  business?: SiteData['business'],
): string {
  const labels = businessLabels(lang);
  const address = s.address?.trim() || business?.address?.trim();
  const phone = s.phone?.trim() || business?.phone?.trim();
  const parts: string[] = [];
  if (address) parts.push(`<p class="location-address">${esc(address)}</p>`);
  if (phone) parts.push(`<p><a href="${escAttr(telHref(phone))}">${esc(phone)}</a></p>`);
  const mapUrl = s.mapUrl ? safeUrl(s.mapUrl) : null;
  if (mapUrl && /^https?:/.test(mapUrl)) {
    parts.push(`<p><a href="${escAttr(mapUrl)}">${labels.map}</a></p>`);
  }
  if (!parts.length) return '';
  return wrap('location', idx, s.title?.trim() || labels.location, parts.join('\n'));
}
