import { getTheme } from '../../themes/index.js';
import { darkestPalette } from '../../engine/render.js';
import type { PhotoShape, SiteData } from '../../engine/types.js';
import { el } from '../dom.js';
import { saveMyTheme } from '../mythemes.js';
import { decodeSiteMeta, validImageDataUrl } from '../site-data.js';
import type { StepCtx } from './content.js';

/** Deterministic "surprise me": walks palette x font combos in order. */
let surpriseCounter = 0;

function choiceRow<T extends string>(
  label: string,
  options: { value: T; name: string }[],
  current: T,
  onPick: (v: T) => void,
): HTMLElement {
  const group = el('div', { class: 'group', role: 'radiogroup', 'aria-label': label });
  group.append(el('h3', { text: label }));
  const row = el('div', { class: 'swatch-row' });
  for (const opt of options) {
    const selected = opt.value === current;
    const btn = el('button', {
      type: 'button',
      class: `font-choice${selected ? ' selected' : ''}`,
      role: 'radio',
      'aria-checked': String(selected),
      text: opt.name,
    });
    btn.addEventListener('click', () => onPick(opt.value));
    row.append(btn);
  }
  group.append(row);
  return group;
}

/** Collapsible band so the step reads as 4 doors, not a wall of controls. */
function band(title: string, open: boolean, ...children: HTMLElement[]): HTMLDetailsElement {
  const d = el('details', { class: 'band' });
  d.open = open;
  d.append(el('summary', { text: title }), ...children);
  return d;
}

export function renderCustomizeStep(pane: HTMLElement, ctx: StepCtx): void {
  const { data, onChange } = ctx;
  const theme = getTheme(data.meta.themeId);
  const meta = data.meta;

  pane.append(el('h2', { text: 'Make it yours' }));
  pane.append(el('p', { class: 'step-intro', text: `Colors, lettering and feel for the ${theme.name} look.` }));

  // Vibes first: one tap gets most people a finished look
  const vibes = el('div', { class: 'group' }, el('h3', { text: 'Vibes - one-tap combos' }));
  const vibeRow = el('div', { class: 'chips-row' });
  const VIBES: { name: string; set: Partial<SiteData['meta']> }[] = [
    { name: 'Calm', set: { surface: 'flat', density: 'airy', shadow: 'none', corners: 'soft' } },
    { name: 'Bold', set: { surface: 'card', corners: 'sharp', shadow: 'lifted', headingStyle: 'caps' } },
    { name: 'Cozy', set: { surface: 'tinted', corners: 'round', shadow: 'soft', density: 'airy', headingStyle: 'highlight', background: 'wash-top' } },
    { name: 'Precise', set: { surface: 'bordered', corners: 'sharp', shadow: 'none', headingStyle: 'underline', density: 'compact', background: 'grid' } },
  ];
  const STYLE_KEYS = ['surface', 'corners', 'shadow', 'density', 'headingStyle', 'heroAlign', 'background'] as const;
  for (const vibe of VIBES) {
    const chip = el('button', { type: 'button', class: 'chip', text: vibe.name });
    chip.addEventListener('click', () => {
      for (const key of STYLE_KEYS) delete meta[key];
      Object.assign(meta, vibe.set);
      onChange(true);
    });
    vibeRow.append(chip);
  }
  const clearVibe = el('button', { type: 'button', class: 'chip', text: 'Reset to theme' });
  clearVibe.addEventListener('click', () => {
    for (const key of STYLE_KEYS) delete meta[key];
    delete meta.textScale;
    delete meta.width;
    delete meta.photoSize;
    delete meta.accent;
    delete meta.customPalette;
    onChange(true);
  });
  vibeRow.append(clearVibe);
  vibes.append(vibeRow);
  pane.append(vibes);

  // ---- Colors ----
  const palGroup = el('div', { class: 'group', role: 'radiogroup', 'aria-label': 'Colors' });
  const swatches = el('div', { class: 'swatch-row' });
  for (const palette of theme.palettes) {
    const selected = meta.paletteId === palette.id && !meta.accent && !meta.customPalette;
    const btn = el('button', {
      type: 'button',
      class: `swatch${selected ? ' selected' : ''}`,
      role: 'radio',
      'aria-checked': String(selected),
      'aria-label': `Colors: ${palette.name}`,
    });
    btn.style.setProperty('--sw-bg', palette.vars.bg);
    btn.style.setProperty('--sw-accent', palette.vars.accent);
    btn.style.setProperty('--sw-text', palette.vars.text);
    btn.append(el('span', { class: 'swatch-name', text: palette.name }));
    btn.addEventListener('click', () => {
      meta.paletteId = palette.id;
      delete meta.accent;
      delete meta.customPalette;
      onChange(true);
    });
    swatches.append(btn);
  }
  palGroup.append(swatches);

  const accentRow = el('div', { class: 'row accent-row' });
  const accentInput = el('input', { type: 'color', 'aria-label': 'Pick your own accent color' });
  accentInput.value = meta.accent ?? theme.palettes.find((p) => p.id === meta.paletteId)?.vars.accent ?? '#3b5bdb';
  accentInput.addEventListener('input', () => {
    meta.accent = accentInput.value;
    onChange();
  });
  accentInput.addEventListener('change', () => onChange(true));
  accentRow.append(
    accentInput,
    el('span', { class: 'hint', text: 'Or pick any accent color - we keep it readable automatically.' }),
  );
  if (meta.accent) {
    const reset = el('button', { type: 'button', class: 'chip', text: 'Back to theme colors' });
    reset.addEventListener('click', () => {
      delete meta.accent;
      onChange(true);
    });
    accentRow.append(reset);
  }
  palGroup.append(accentRow);

  const colorsChildren: HTMLElement[] = [palGroup];

  const dark = darkestPalette(theme);
  const currentPalette = theme.palettes.find((p) => p.id === meta.paletteId);
  if (dark && currentPalette && dark.id !== currentPalette.id) {
    const wrap = el('div', { class: 'group' });
    const label = el('label', { class: 'check-row' });
    const box = el('input', { type: 'checkbox' });
    box.checked = Boolean(meta.autoDark);
    box.addEventListener('change', () => {
      if (box.checked) meta.autoDark = true;
      else delete meta.autoDark;
      onChange();
    });
    label.append(box, el('span', { text: `Follow dark mode (visitors with dark mode see the ${dark.name} colors)` }));
    wrap.append(label);
    colorsChildren.push(wrap);
  }

  // full color designer (advanced door inside Colors)
  const designer = el('details', { class: 'group designer' });
  designer.append(el('summary', { text: 'Design your own colors (advanced)' }));
  designer.open = Boolean(meta.customPalette);
  const basePalette = theme.palettes.find((p) => p.id === meta.paletteId) ?? theme.palettes[0]!;
  const current = meta.customPalette ?? {
    bg: basePalette.vars.bg,
    surface: basePalette.vars.surface,
    text: basePalette.vars.text,
    muted: basePalette.vars.muted,
    accent: basePalette.vars.accent,
  };
  designer.append(
    el('p', {
      class: 'hint',
      text: 'Pick any five colors. If a combination would be hard to read, we nudge it just enough to stay readable - always.',
    }),
  );
  const fields: [keyof typeof current, string][] = [
    ['bg', 'Background'],
    ['surface', 'Cards'],
    ['text', 'Text'],
    ['muted', 'Quiet text'],
    ['accent', 'Accent'],
  ];
  const designRow = el('div', { class: 'chips-row' });
  for (const [key, label] of fields) {
    const cell = el('label', { class: 'design-cell' });
    const input = el('input', { type: 'color', 'aria-label': `${label} color` });
    input.value = current[key]!;
    input.addEventListener('input', () => {
      current[key] = input.value;
      meta.customPalette = { ...current };
      onChange();
    });
    input.addEventListener('change', () => onChange(true));
    cell.append(input, el('span', { class: 'hint', text: label }));
    designRow.append(cell);
  }
  designer.append(designRow);
  if (meta.customPalette) {
    const clear = el('button', { type: 'button', class: 'chip', text: 'Back to theme colors' });
    clear.addEventListener('click', () => {
      delete meta.customPalette;
      onChange(true);
    });
    designer.append(clear);
  }
  colorsChildren.push(designer);

  pane.append(
    band('Colors', true, ...colorsChildren),
  );

  // ---- Lettering & text ----
  const fontsGroup = choiceRow(
    'Lettering',
    theme.fonts.map((f) => ({ value: f.id, name: f.name })),
    meta.fontId,
    (v) => {
      meta.fontId = v;
      onChange(true);
    },
  );
  for (const [i, btn] of [...fontsGroup.querySelectorAll('.font-choice')].entries()) {
    const font = theme.fonts[i];
    if (!font) continue;
    const sample = el('span', { class: 'font-sample', text: 'Aa' });
    sample.style.fontFamily = font.headingStack ?? font.stack;
    btn.prepend(sample);
  }
  pane.append(
    band(
      'Lettering & text',
      Boolean(meta.headingStyle || (meta.textScale && meta.textScale !== 'm')),
      fontsGroup,
      choiceRow<'theme' | 'underline' | 'highlight' | 'caps'>(
        'Headings',
        [
          { value: 'theme', name: "Theme's own" },
          { value: 'underline', name: 'Underlined' },
          { value: 'highlight', name: 'Highlighted' },
          { value: 'caps', name: 'All caps' },
        ],
        meta.headingStyle ?? 'theme',
        (v) => {
          if (v === 'theme') delete meta.headingStyle;
          else meta.headingStyle = v;
          onChange(true);
        },
      ),
      choiceRow(
        'Text size',
        [
          { value: 's', name: 'Compact' },
          { value: 'm', name: 'Normal' },
          { value: 'l', name: 'Large' },
        ],
        meta.textScale ?? 'm',
        (v) => {
          meta.textScale = v;
          onChange(true);
        },
      ),
    ),
  );

  // ---- Layout ----
  const layoutChildren: HTMLElement[] = [
    choiceRow<'theme' | 'center' | 'left'>(
      'Top of the page',
      [
        { value: 'theme', name: "Theme's own" },
        { value: 'center', name: 'Centered' },
        { value: 'left', name: 'Left' },
      ],
      meta.heroAlign ?? 'theme',
      (v) => {
        if (v === 'theme') delete meta.heroAlign;
        else meta.heroAlign = v;
        onChange(true);
      },
    ),
  ];
  if (data.photo) {
    layoutChildren.push(
      choiceRow<PhotoShape>(
        'Photo shape',
        [
          { value: 'circle', name: 'Circle' },
          { value: 'rounded', name: 'Rounded' },
          { value: 'square', name: 'Square' },
        ],
        meta.photoShape ?? theme.photoShape,
        (v) => {
          meta.photoShape = v;
          onChange(true);
        },
      ),
      choiceRow<'s' | 'theme' | 'l'>(
        'Photo size',
        [
          { value: 's', name: 'Small' },
          { value: 'theme', name: "Theme's own" },
          { value: 'l', name: 'Large' },
        ],
        meta.photoSize ?? 'theme',
        (v) => {
          if (v === 'theme') delete meta.photoSize;
          else meta.photoSize = v;
          onChange(true);
        },
      ),
    );
  }
  // Custom tab icon (favicon); default is the generated initials mark
  const favGroup = el('div', { class: 'group' });
  favGroup.append(el('h3', { text: 'Tab icon' }));
  if (data.favicon) {
    const img = el('img', { class: 'fav-thumb', alt: 'Your tab icon' });
    img.src = data.favicon.dataUrl;
    const rm = el('button', { type: 'button', class: 'chip', text: 'Use the generated icon instead' });
    rm.addEventListener('click', () => {
      delete data.favicon;
      onChange(true);
    });
    favGroup.append(el('div', { class: 'row center' }, img, rm));
  } else {
    const favInput = el('input', { type: 'file', accept: 'image/*', class: 'visually-hidden' });
    const favBtn = el('button', { type: 'button', class: 'chip', text: 'Upload your own tab icon' });
    favBtn.addEventListener('click', () => favInput.click());
    favInput.addEventListener('change', async () => {
      const file = favInput.files?.[0];
      if (!file) return;
      try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const side = Math.min(bitmap.width, bitmap.height);
        canvas.getContext('2d')!.drawImage(
          bitmap,
          (bitmap.width - side) / 2,
          (bitmap.height - side) / 2,
          side,
          side,
          0,
          0,
          64,
          64,
        );
        bitmap.close();
        const dataUrl = canvas.toDataURL('image/png');
        if (!validImageDataUrl(dataUrl)) throw new Error('image');
        data.favicon = { dataUrl };
        onChange(true);
      } catch {
        favGroup.append(el('p', { class: 'error', text: 'Sorry, that image could not be read.' }));
      }
    });
    favGroup.append(
      favBtn,
      favInput,
      el('p', { class: 'hint', text: 'The little icon in the browser tab. Without one we make a neat initials icon for you.' }),
    );
  }
  layoutChildren.push(favGroup);

  layoutChildren.push(
    choiceRow(
      'Page width',
      [
        { value: 'narrow', name: 'Narrow' },
        { value: 'normal', name: 'Normal' },
        { value: 'wide', name: 'Wide' },
      ],
      meta.width ?? 'normal',
      (v) => {
        meta.width = v;
        onChange(true);
      },
    ),
    choiceRow(
      'Spacing',
      [
        { value: 'compact', name: 'Compact' },
        { value: 'normal', name: 'Normal' },
        { value: 'airy', name: 'Airy' },
      ],
      meta.density ?? 'normal',
      (v) => {
        meta.density = v;
        onChange(true);
      },
    ),
  );
  pane.append(
    band(
      'Layout',
      Boolean(meta.heroAlign || meta.photoSize || (meta.width && meta.width !== 'normal') || (meta.density && meta.density !== 'normal')),
      ...layoutChildren,
    ),
  );

  // ---- Sections & background ----
  const feelChildren: HTMLElement[] = [
    choiceRow<'theme' | 'card' | 'flat' | 'bordered' | 'tinted'>(
      'Sections',
      [
        { value: 'theme', name: "Theme's own" },
        { value: 'card', name: 'Cards' },
        { value: 'flat', name: 'Flat' },
        { value: 'bordered', name: 'Bordered' },
        { value: 'tinted', name: 'Tinted' },
      ],
      meta.surface ?? 'theme',
      (v) => {
        if (v === 'theme') delete meta.surface;
        else meta.surface = v;
        onChange(true);
      },
    ),
  ];
  if (meta.surface && meta.surface !== 'flat') {
    feelChildren.push(
      choiceRow(
        'Corners',
        [
          { value: 'sharp', name: 'Sharp' },
          { value: 'soft', name: 'Soft' },
          { value: 'round', name: 'Round' },
        ],
        meta.corners ?? 'soft',
        (v) => {
          meta.corners = v;
          onChange(true);
        },
      ),
      choiceRow(
        'Shadow',
        [
          { value: 'none', name: 'None' },
          { value: 'soft', name: 'Soft' },
          { value: 'lifted', name: 'Lifted' },
        ],
        meta.shadow ?? 'soft',
        (v) => {
          meta.shadow = v;
          onChange(true);
        },
      ),
    );
  }
  feelChildren.push(
    choiceRow<'theme' | 'dots' | 'grid' | 'lines' | 'wash-top' | 'wash-corner'>(
      'Background',
      [
        { value: 'theme', name: "Theme's own" },
        { value: 'dots', name: 'Dots' },
        { value: 'grid', name: 'Grid' },
        { value: 'lines', name: 'Lines' },
        { value: 'wash-top', name: 'Glow top' },
        { value: 'wash-corner', name: 'Glow corner' },
      ],
      meta.background ?? 'theme',
      (v) => {
        if (v === 'theme') delete meta.background;
        else meta.background = v;
        onChange(true);
      },
    ),
  );
  pane.append(
    band('Sections & background', Boolean(meta.surface || meta.background), ...feelChildren),
  );

  // ---- bottom actions: keep, share, roll the dice ----
  const actions = el('div', { class: 'chips-row bottom-actions' });

  const saveLook = el('button', { type: 'button', class: 'chip', text: 'Save this look as your own theme' });
  saveLook.addEventListener('click', () => {
    const name = prompt('Name your theme:', 'My look');
    if (!name?.trim()) return;
    saveMyTheme(name.trim().slice(0, 40), meta);
    saveLook.textContent = `Saved "${name.trim().slice(0, 40)}" - find it on the Look step`;
    setTimeout(() => {
      saveLook.textContent = 'Save this look as your own theme';
    }, 2500);
  });

  const exportBtn = el('button', { type: 'button', class: 'chip', text: 'Export this look (.json)' });
  exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ pageforgeTheme: 1, meta }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: 'my-look.pageforge-theme.json' });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  });

  const importInput = el('input', { type: 'file', accept: '.json,application/json', class: 'visually-hidden' });
  const importBtn = el('button', { type: 'button', class: 'chip', text: 'Load a look file' });
  importBtn.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { pageforgeTheme?: unknown; meta?: unknown };
      const meta = decodeSiteMeta(parsed.meta);
      if (parsed.pageforgeTheme !== 1 || !meta || typeof (parsed.meta as { themeId?: unknown })?.themeId !== 'string') {
        throw new Error('shape');
      }
      data.meta = meta;
      onChange(true);
    } catch {
      actions.append(el('span', { class: 'error', text: 'That does not look like a pageforge look file.' }));
    }
  });

  const surprise = el('button', { type: 'button', class: 'chip', text: 'Surprise me' });
  surprise.addEventListener('click', () => {
    surpriseCounter += 1;
    const combos: { paletteId: string; fontId: string }[] = [];
    for (const p of theme.palettes) for (const f of theme.fonts) combos.push({ paletteId: p.id, fontId: f.id });
    const pick = combos[surpriseCounter % combos.length]!;
    meta.paletteId = pick.paletteId;
    meta.fontId = pick.fontId;
    delete meta.accent;
    delete meta.customPalette;
    onChange(true);
  });

  actions.append(saveLook, exportBtn, importBtn, importInput, surprise);
  pane.append(actions);
}
