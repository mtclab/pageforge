import { entityEncode, esc, escAttr, safeUrl, textToHtml } from '../escape.js';
import { galleryPath, type Section } from '../types.js';

/**
 * All <main> section renderers. Each returns '' when the section has no
 * content, so empty sections never render. `idx` keys the aria-labelledby ids.
 */
export function renderSection(section: Section, idx: number): string {
  switch (section.kind) {
    case 'about':
      return renderAbout(section, idx);
    case 'projects':
      return renderProjects(section, idx);
    case 'hobbies':
      return renderHobbies(section, idx);
    case 'contact':
      return renderContact(section, idx);
    case 'custom':
      return renderCustom(section, idx);
    case 'gallery':
      return renderGallery(section, idx);
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

function renderContact(s: Extract<Section, { kind: 'contact' }>, idx: number): string {
  const parts: string[] = [];
  if (s.email?.trim()) {
    const email = s.email.trim();
    const url = safeUrl(`mailto:${email}`);
    // entity-encoded so plain-text scrapers do not harvest the address
    parts.push(
      url
        ? `<p><a href="${entityEncode(url)}">${entityEncode(email)}</a></p>`
        : `<p>${entityEncode(email)}</p>`,
    );
  }
  if (s.note?.trim()) parts.push(textToHtml(s.note));
  if (!parts.length) return '';
  return wrap('contact', idx, 'Get in touch', parts.join('\n'));
}

function renderGallery(s: Extract<Section, { kind: 'gallery' }>, idx: number): string {
  const items = s.photos.map(
    (_, j) =>
      `<li><img src="${galleryPath(idx, j)}" alt="" loading="lazy"></li>`,
  );
  if (!items.length) return '';
  return wrap('gallery', idx, s.title?.trim() || 'Photos', `<ul class="gallery">\n${items.join('\n')}\n</ul>`);
}

function renderCustom(s: Extract<Section, { kind: 'custom' }>, idx: number): string {
  const body = textToHtml(s.text);
  if (!body || !s.title.trim()) return '';
  return wrap('custom', idx, s.title.trim(), body);
}
