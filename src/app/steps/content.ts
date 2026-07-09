import type { Section, SiteData } from '../../engine/types.js';
import { el, labeled } from '../dom.js';
import { renderPhotoField } from '../photo.js';

export interface StepCtx {
  data: SiteData;
  /** Persist + refresh preview. Pass structural=true to re-render the form pane too. */
  onChange: (structural?: boolean) => void;
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
  { label: '+ How to reach me', make: () => ({ kind: 'contact' }) },
  { label: '+ Own section', make: () => ({ kind: 'custom', title: '', text: '' }) },
];

export function renderContentStep(pane: HTMLElement, ctx: StepCtx): void {
  const { data, onChange } = ctx;
  pane.append(el('h2', { text: 'Tell us about you' }));
  pane.append(
    el('p', {
      class: 'step-intro',
      text: 'Only your name is required. Everything else is optional - your page shows just what you fill in.',
    }),
  );

  pane.append(importField(ctx));

  const nameInput = textInput(data.name, 'e.g. Anna Virtanen', (v) => {
    data.name = v;
    onChange();
  });
  nameInput.required = true;
  nameInput.autocomplete = 'name';
  pane.append(labeled('Your name', nameInput));

  pane.append(
    labeled(
      'A short line about you',
      textInput(data.tagline ?? '', 'e.g. Dog person, amateur astronomer', (v) => {
        data.tagline = v;
        onChange();
      }),
    ),
  );

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
      onChange();
    });
    const labelInput = textInput(link.label, 'Name it, e.g. My Instagram', (v) => {
      link.label = v;
      onChange();
    });
    const remove = el('button', { type: 'button', class: 'icon-btn', 'aria-label': `Remove link ${i + 1}`, text: '✕' });
    remove.addEventListener('click', () => {
      data.links.splice(i, 1);
      onChange(true);
    });
    row.append(urlInput, labelInput, remove);
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

/** "Edited here before? Load the site.json from your old zip." */
function importField(ctx: StepCtx): HTMLElement {
  const { data, onChange } = ctx;
  const input = el('input', { type: 'file', accept: '.json,application/json', class: 'visually-hidden' });
  const btn = el('button', { type: 'button', class: 'chip', text: 'Made a site here before? Load your site.json' });
  const wrap = el('div', { class: 'field import-field' }, btn, input);
  btn.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as SiteData;
      if (parsed.version !== 1 || typeof parsed.name !== 'string' || !Array.isArray(parsed.sections)) {
        throw new Error('shape');
      }
      data.name = parsed.name;
      data.tagline = parsed.tagline;
      data.photo = parsed.photo;
      data.links = parsed.links ?? [];
      data.sections = parsed.sections;
      data.footerNote = parsed.footerNote;
      data.meta = parsed.meta ?? data.meta;
      onChange(true);
    } catch {
      wrap.append(el('p', { class: 'error', text: 'That file does not look like a pageforge site.json.' }));
    }
  });
  return wrap;
}

const SECTION_TITLES: Record<Section['kind'], string> = {
  about: 'About me',
  projects: 'Things I make',
  hobbies: 'Things I love',
  contact: 'How to reach me',
  custom: 'Own section',
};

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
        onChange();
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
          onChange();
        });
        const desc = el('input', { type: 'text', placeholder: 'One line about it (optional)' });
        desc.value = item.desc ?? '';
        desc.addEventListener('input', () => {
          item.desc = desc.value;
          onChange();
        });
        const url = el('input', { type: 'text', placeholder: 'Link (optional)' });
        url.value = item.url ?? '';
        url.addEventListener('input', () => {
          item.url = url.value;
          onChange();
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
        onChange();
      });
      card.append(labeled('List them, separated by commas', input));
      break;
    }
    case 'contact': {
      const email = el('input', { type: 'email', placeholder: 'you@example.com' });
      email.value = section.email ?? '';
      email.addEventListener('input', () => {
        section.email = email.value;
        onChange();
      });
      card.append(labeled('Email (shown on your page)', email));
      const note = el('input', { type: 'text', placeholder: 'e.g. Happy to chat about gardens or bread.' });
      note.value = section.note ?? '';
      note.addEventListener('input', () => {
        section.note = note.value;
        onChange();
      });
      card.append(labeled('A short note (optional)', note));
      break;
    }
    case 'custom': {
      const title = el('input', { type: 'text', placeholder: 'Section title, e.g. Reading now' });
      title.value = section.title;
      title.addEventListener('input', () => {
        section.title = title.value;
        onChange();
      });
      card.append(labeled('Title', title));
      const ta = el('textarea', { rows: '4', placeholder: 'Whatever you want to say.' });
      ta.value = section.text;
      ta.addEventListener('input', () => {
        section.text = ta.value;
        onChange();
      });
      card.append(ta);
      break;
    }
  }
  return card;
}
