import type { Section, SiteData } from '../../engine/types.js';
import { el, labeled } from '../dom.js';
import { fileToResizedDataUrl, renderPhotoField } from '../photo.js';
import { decodeSiteData, replaceSiteData } from '../site-data.js';
import { STARTERS } from '../starters.js';
import { deletePage, listPages, newPage, switchPage } from '../state.js';

export interface StepCtx {
  data: SiteData;
  /** Text field identity is used only to coalesce consecutive keystrokes. */
  onChange: (structural?: boolean, textField?: string) => void;
}

function textInput(value: string, placeholder: string, oninput: (v: string) => void): HTMLInputElement {
  const input = el('input', { type: 'text', placeholder });
  input.value = value;
  input.addEventListener('input', () => oninput(input.value));
  return input;
}

const SECTION_MENU: { label: string; make: () => Section }[] = [
  { label: '+ About me', make: () => ({ kind: 'about', text: '' }) },
  { label: '+ Things I make', make: () => ({ kind: 'projects', items: [{ name: '' }] }) },
  { label: '+ Things I love', make: () => ({ kind: 'hobbies', items: [] }) },
  { label: '+ Photo gallery', make: () => ({ kind: 'gallery', photos: [] }) },
  { label: '+ How to reach me', make: () => ({ kind: 'contact' }) },
  { label: '+ Own section', make: () => ({ kind: 'custom', title: '', text: '' }) },
];

const GALLERY_MAX = 6;

export function renderContentStep(pane: HTMLElement, ctx: StepCtx): void {
  const { data, onChange } = ctx;
  pane.append(el('h2', { text: 'Tell us about you' }));
  pane.append(
    el('p', {
      class: 'step-intro',
      text: 'Only your name is required. Everything else is optional - your page shows just what you fill in.',
    }),
  );

  pane.append(pagesRow(), starterRow(ctx), importField(ctx));

  const nameInput = textInput(data.name, 'e.g. Anna Virtanen', (v) => {
    data.name = v;
    onChange(false, 'name');
  });
  nameInput.required = true;
  nameInput.autocomplete = 'name';
  pane.append(labeled('Your name', nameInput));

  pane.append(
    labeled(
      'A short line about you',
      textInput(data.tagline ?? '', 'e.g. Dog person, amateur astronomer', (v) => {
        data.tagline = v;
        onChange(false, 'tagline');
      }),
    ),
  );

  // Page language: sets html lang on the generated site (screen readers,
  // hyphenation, search). The wizard UI itself stays English.
  const langSelect = el('select', { 'aria-label': 'Language of your page' });
  const LANGS: [string, string][] = [
    ['en', 'English'],
    ['fi', 'Suomi'],
    ['sv', 'Svenska'],
    ['de', 'Deutsch'],
    ['fr', 'Français'],
    ['es', 'Español'],
    ['it', 'Italiano'],
    ['pt', 'Português'],
    ['nl', 'Nederlands'],
    ['da', 'Dansk'],
    ['no', 'Norsk'],
    ['et', 'Eesti'],
    ['pl', 'Polski'],
    ['uk', 'Українська'],
    ['ja', '日本語'],
  ];
  for (const [code, label] of LANGS) {
    langSelect.append(el('option', { value: code, text: label }));
  }
  langSelect.value = data.lang ?? 'en';
  langSelect.addEventListener('change', () => {
    data.lang = langSelect.value;
    onChange();
  });
  pane.append(labeled('Language of your page', langSelect, 'What language you write your content in.'));

  pane.append(renderPhotoField(ctx));

  // Links
  const linksBox = el('fieldset', { class: 'group' }, el('legend', { text: 'Your links' }));
  linksBox.append(
    el('p', { class: 'hint', text: 'Paste a link (Instagram, email, anything) - the icon is picked for you.' }),
  );
  data.links.forEach((link, i) => {
    const row = el('div', { class: 'row' });
    const urlInput = textInput(link.url, 'e.g. instagram.com/yourname', (v) => {
      link.url = v;
      onChange(false, `links.${i}.url`);
    });
    const labelInput = textInput(link.label, 'Name it, e.g. My Instagram', (v) => {
      link.label = v;
      onChange(false, `links.${i}.label`);
    });
    const up = el('button', { type: 'button', class: 'icon-btn', 'aria-label': `Move link ${i + 1} up`, text: '↑' });
    const down = el('button', { type: 'button', class: 'icon-btn', 'aria-label': `Move link ${i + 1} down`, text: '↓' });
    up.disabled = i === 0;
    down.disabled = i === data.links.length - 1;
    up.addEventListener('click', () => {
      data.links.splice(i - 1, 0, ...data.links.splice(i, 1));
      onChange(true);
    });
    down.addEventListener('click', () => {
      data.links.splice(i + 1, 0, ...data.links.splice(i, 1));
      onChange(true);
    });
    const remove = el('button', { type: 'button', class: 'icon-btn', 'aria-label': `Remove link ${i + 1}`, text: '✕' });
    remove.addEventListener('click', () => {
      data.links.splice(i, 1);
      onChange(true);
    });
    row.append(urlInput, labelInput, up, down, remove);
    linksBox.append(row);
  });
  const addLink = el('button', { type: 'button', class: 'chip', text: '+ Add a link' });
  addLink.addEventListener('click', () => {
    data.links.push({ label: '', url: '' });
    onChange(true);
  });
  linksBox.append(addLink);
  pane.append(linksBox);

  // Sections
  const secBox = el('fieldset', { class: 'group' }, el('legend', { text: 'Sections' }));
  data.sections.forEach((section, i) => secBox.append(sectionEditor(section, i, ctx)));
  const menu = el('div', { class: 'chips-row' });
  for (const item of SECTION_MENU) {
    const btn = el('button', { type: 'button', class: 'chip', text: item.label });
    btn.addEventListener('click', () => {
      data.sections.push(item.make());
      onChange(true);
    });
    menu.append(btn);
  }
  secBox.append(menu);
  pane.append(secBox);
}

/** Several pages in one browser: personal + event + club at once. */
function pagesRow(): HTMLElement {
  const pages = listPages();
  const wrap = el('div', { class: 'field pages-row' });
  if (pages.length === 1 && pages[0]![1] === 'Untitled page') {
    // single empty page: no switcher noise
    return wrap;
  }
  wrap.append(el('span', { class: 'label', text: 'My pages' }));
  const chips = el('div', { class: 'chips-row' });
  for (const [id, name, active] of pages) {
    const chip = el('button', {
      type: 'button',
      class: `chip${active ? ' chip-active' : ''}`,
      'aria-pressed': String(active),
      text: name,
    });
    chip.addEventListener('click', () => {
      if (active) return;
      switchPage(id);
      location.reload();
    });
    chips.append(chip);
    if (active && pages.length > 1) {
      const del = el('button', { type: 'button', class: 'icon-btn', 'aria-label': `Delete page ${name}`, text: '✕' });
      del.addEventListener('click', () => {
        if (!confirm(`Delete the page "${name}"? This cannot be undone.`)) return;
        deletePage(id);
        location.reload();
      });
      chips.append(del);
    }
  }
  const add = el('button', { type: 'button', class: 'chip', text: '+ New page' });
  add.addEventListener('click', () => {
    newPage();
    location.reload();
  });
  chips.append(add);
  wrap.append(chips);
  return wrap;
}

/** One-click example content; doubles as page types (event, business, club...). */
function starterRow(ctx: StepCtx): HTMLElement {
  const { data, onChange } = ctx;
  const wrap = el('div', { class: 'field starter-row' });
  wrap.append(el('span', { class: 'label', text: 'Not sure where to start? Try an example' }));
  const chips = el('div', { class: 'chips-row' });
  for (const starter of STARTERS) {
    const btn = el('button', { type: 'button', class: 'chip', title: starter.blurb, text: starter.label });
    btn.addEventListener('click', () => {
      const hasContent = data.name.trim() || data.sections.length || data.links.length;
      if (hasContent && !confirm('Replace what you have written with this example?')) return;
      const copy = structuredClone(starter.data);
      data.name = copy.name;
      data.tagline = copy.tagline;
      delete data.photo;
      data.links = copy.links;
      data.sections = copy.sections;
      data.footerNote = copy.footerNote;
      data.meta = copy.meta;
      onChange(true);
    });
    chips.append(btn);
  }
  wrap.append(chips);
  return wrap;
}

/** "Edited here before? Load your old zip (or the site.json inside it)." */
function importField(ctx: StepCtx): HTMLElement {
  const { data, onChange } = ctx;
  const input = el('input', { type: 'file', accept: '.json,.zip,application/json,application/zip', class: 'visually-hidden' });
  const btn = el('button', { type: 'button', class: 'chip', text: 'Made a site here before? Load your zip or site.json' });
  const wrap = el('div', { class: 'field import-field' }, btn, input);
  btn.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      let text: string;
      if (/\.zip$/i.test(file.name)) {
        const { unzipSync, strFromU8 } = await import('fflate');
        const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
        const siteJson = entries['site.json'];
        if (!siteJson) throw new Error('no site.json in zip');
        text = strFromU8(siteJson);
      } else {
        text = await file.text();
      }
      const parsed = decodeSiteData(JSON.parse(text));
      if (!parsed) throw new Error('shape');
      replaceSiteData(data, parsed);
      onChange(true);
    } catch {
      wrap.append(el('p', { class: 'error', text: 'That file does not look like a pageforge site.json.' }));
    }
  });
  return wrap;
}

const SECTION_TITLES = {
  about: 'About me',
  projects: 'Things I make',
  hobbies: 'Things I love',
  contact: 'How to reach me',
  custom: 'Own section',
  gallery: 'Photo gallery',
} as Record<Section['kind'], string>;

function sectionEditor(section: Section, i: number, ctx: StepCtx): HTMLElement {
  const { data, onChange } = ctx;
  const card = el('div', { class: 'card' });
  const head = el('div', { class: 'card-head' }, el('h3', { text: SECTION_TITLES[section.kind] }));
  const tools = el('div', { class: 'card-tools' });
  const up = el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Move up', text: '↑' });
  const down = el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Move down', text: '↓' });
  const remove = el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Remove section', text: '✕' });
  up.disabled = i === 0;
  down.disabled = i === data.sections.length - 1;
  up.addEventListener('click', () => {
    data.sections.splice(i - 1, 0, ...data.sections.splice(i, 1));
    onChange(true);
  });
  down.addEventListener('click', () => {
    data.sections.splice(i + 1, 0, ...data.sections.splice(i, 1));
    onChange(true);
  });
  remove.addEventListener('click', () => {
    data.sections.splice(i, 1);
    onChange(true);
  });
  tools.append(up, down, remove);
  head.append(tools);
  card.append(head);

  switch (section.kind) {
    case 'about': {
      const ta = el('textarea', { rows: '5', placeholder: 'A few sentences about you. Blank line starts a new paragraph.' });
      ta.value = section.text;
      ta.addEventListener('input', () => {
        section.text = ta.value;
        onChange(false, `sections.${i}.about.text`);
      });
      card.append(ta);
      break;
    }
    case 'projects': {
      section.items.forEach((item, j) => {
        const row = el('div', { class: 'row wrap' });
        const name = el('input', { type: 'text', placeholder: 'What is it called?' });
        name.value = item.name;
        name.addEventListener('input', () => {
          item.name = name.value;
          onChange(false, `sections.${i}.projects.${j}.name`);
        });
        const desc = el('input', { type: 'text', placeholder: 'One line about it (optional)' });
        desc.value = item.desc ?? '';
        desc.addEventListener('input', () => {
          item.desc = desc.value;
          onChange(false, `sections.${i}.projects.${j}.desc`);
        });
        const url = el('input', { type: 'text', placeholder: 'Link (optional)' });
        url.value = item.url ?? '';
        url.addEventListener('input', () => {
          item.url = url.value;
          onChange(false, `sections.${i}.projects.${j}.url`);
        });
        const rm = el('button', { type: 'button', class: 'icon-btn', 'aria-label': `Remove item ${j + 1}`, text: '✕' });
        rm.addEventListener('click', () => {
          section.items.splice(j, 1);
          onChange(true);
        });
        row.append(name, desc, url, rm);
        card.append(row);
      });
      const add = el('button', { type: 'button', class: 'chip', text: '+ Add one more' });
      add.addEventListener('click', () => {
        section.items.push({ name: '' });
        onChange(true);
      });
      card.append(add);
      break;
    }
    case 'hobbies': {
      const input = el('input', {
        type: 'text',
        placeholder: 'e.g. Gardening, Baking, Winter swimming',
      });
      input.value = section.items.join(', ');
      input.addEventListener('input', () => {
        section.items = input.value.split(',').map((s) => s.trim()).filter(Boolean);
        onChange(false, `sections.${i}.hobbies.items`);
      });
      card.append(labeled('List them, separated by commas', input));
      break;
    }
    case 'contact': {
      const email = el('input', { type: 'email', placeholder: 'you@example.com' });
      email.value = section.email ?? '';
      email.addEventListener('input', () => {
        section.email = email.value;
        onChange(false, `sections.${i}.contact.email`);
      });
      card.append(labeled('Email (shown on your page)', email));
      const note = el('input', { type: 'text', placeholder: 'e.g. Happy to chat about gardens or bread.' });
      note.value = section.note ?? '';
      note.addEventListener('input', () => {
        section.note = note.value;
        onChange(false, `sections.${i}.contact.note`);
      });
      card.append(labeled('A short note (optional)', note));
      break;
    }
    case 'gallery': {
      const thumbs = el('div', { class: 'row wrap' });
      section.photos.forEach((photo, j) => {
        const cell = el('span', { class: 'gallery-thumb' });
        const img = el('img', { alt: `Gallery photo ${j + 1}` });
        img.src = photo.dataUrl;
        const rm = el('button', { type: 'button', class: 'icon-btn', 'aria-label': `Remove photo ${j + 1}`, text: '✕' });
        rm.addEventListener('click', () => {
          section.photos.splice(j, 1);
          onChange(true);
        });
        cell.append(img, rm);
        thumbs.append(cell);
      });
      card.append(thumbs);
      if (section.photos.length < GALLERY_MAX) {
        const input = el('input', { type: 'file', accept: 'image/*', multiple: 'multiple', class: 'visually-hidden' });
        const add = el('button', { type: 'button', class: 'chip', text: '+ Add photos' });
        add.addEventListener('click', () => input.click());
        input.addEventListener('change', async () => {
          const files = [...(input.files ?? [])].slice(0, GALLERY_MAX - section.photos.length);
          for (const file of files) {
            try {
              section.photos.push({ dataUrl: await fileToResizedDataUrl(file) });
            } catch {
              // unreadable image: skip it
            }
          }
          onChange(true);
        });
        card.append(add, input, el('p', { class: 'hint', text: `Up to ${GALLERY_MAX} photos. They are packed into your site.` }));
      } else {
        card.append(el('p', { class: 'hint', text: `Gallery is full (${GALLERY_MAX} photos).` }));
      }
      break;
    }
    case 'custom': {
      const title = el('input', { type: 'text', placeholder: 'Section title, e.g. Reading now' });
      title.value = section.title;
      title.addEventListener('input', () => {
        section.title = title.value;
        onChange(false, `sections.${i}.custom.title`);
      });
      card.append(labeled('Title', title));
      const ta = el('textarea', { rows: '4', placeholder: 'Whatever you want to say.' });
      ta.value = section.text;
      ta.addEventListener('input', () => {
        section.text = ta.value;
        onChange(false, `sections.${i}.custom.text`);
      });
      card.append(ta);
      break;
    }
  }
  return card;
}
