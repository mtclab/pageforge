import { esc, escAttr, safeUrl, textToHtml } from '../escape.js';
import { obfuscatedEmailLink } from '../links.js';
import { galleryPath, type LabelContext, type Section } from '../types.js';

/**
 * All <main> section renderers. Each returns '' when the section has no
 * content, so empty sections never render. `idx` keys the aria-labelledby ids.
 * `ctx` carries the label set for the page's language.
 */
export function renderSection(section: Section, idx: number, ctx: LabelContext): string {
  switch (section.kind) {
    case 'about':
      return renderAbout(section, idx, ctx);
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

function renderAbout(
  s: Extract<Section, { kind: 'about' }>,
  idx: number,
  ctx: LabelContext,
): string {
  const body = textToHtml(s.text);
  if (!body) return '';
  return wrap('about', idx, ctx.personal.about, body, ctx.labelLangAttr);
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
    const link = url
      ? obfuscatedEmailLink(url, ctx.personal.email, '', ctx.labelLangAttr)
      : '';
    if (link) parts.push(`<p>${link}</p>`);
  }
  if (s.note?.trim()) parts.push(textToHtml(s.note));
  if (!parts.length) return '';
  return wrap('contact', idx, ctx.personal.contact, parts.join('\n'), ctx.labelLangAttr);
}

function renderGallery(
  s: Extract<Section, { kind: 'gallery' }>,
  idx: number,
  ctx: LabelContext,
): string {
  const items = s.photos.map(
    (photo, j) => {
      // A described photo carries its description; one the author left blank
      // stays alt="" so screen readers skip it instead of reading a filename.
      const alt = escAttr(photo.alt?.trim() ?? '');
      return `<li><img src="${galleryPath(idx, j)}" alt="${alt}" loading="lazy"></li>`;
    },
  );
  if (!items.length) return '';
  const custom = s.title?.trim();
  return wrap(
    'gallery',
    idx,
    custom || ctx.personal.gallery,
    `<ul class="gallery">\n${items.join('\n')}\n</ul>`,
    custom ? '' : ctx.labelLangAttr,
  );
}

function renderCustom(s: Extract<Section, { kind: 'custom' }>, idx: number): string {
  const body = textToHtml(s.text);
  if (!body || !s.title.trim()) return '';
  return wrap('custom', idx, s.title.trim(), body);
}
