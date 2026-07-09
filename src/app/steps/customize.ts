import { getTheme } from '../../themes/index.js';
import { darkestPalette } from '../../engine/render.js';
import type { PhotoShape, SiteData } from '../../engine/types.js';
import { el } from '../dom.js';
import { saveMyTheme } from '../mythemes.js';
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

export function renderCustomizeStep(pane: HTMLElement, ctx: StepCtx): void {
  const { data, onChange } = ctx;
  const theme = getTheme(data.meta.themeId);

  pane.append(el('h2', { text: 'Make it yours' }));
  pane.append(el('p', { class: 'step-intro', text: `Colors, lettering and feel for the ${theme.name} look.` }));

  // Colors: theme palettes + free accent picker
  const palGroup = el('div', { class: 'group', role: 'radiogroup', 'aria-label': 'Colors' });
  palGroup.append(el('h3', { text: 'Colors' }));
  const swatches = el('div', { class: 'swatch-row' });
  for (const palette of theme.palettes) {
    const selected = data.meta.paletteId === palette.id && !data.meta.accent;
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
      data.meta.paletteId = palette.id;
      delete data.meta.accent;
      onChange(true);
    });
    swatches.append(btn);
  }
  palGroup.append(swatches);

  const accentRow = el('div', { class: 'row accent-row' });
  const accentInput = el('input', { type: 'color', 'aria-label': 'Pick your own accent color' });
  accentInput.value = data.meta.accent ?? theme.palettes.find((p) => p.id === data.meta.paletteId)?.vars.accent ?? '#3b5bdb';
  accentInput.addEventListener('input', () => {
    data.meta.accent = accentInput.value;
    onChange();
  });
  accentInput.addEventListener('change', () => onChange(true));
  accentRow.append(
    accentInput,
    el('span', { class: 'hint', text: 'Or pick any accent color - we keep it readable automatically.' }),
  );
  if (data.meta.accent) {
    const reset = el('button', { type: 'button', class: 'chip', text: 'Back to theme colors' });
    reset.addEventListener('click', () => {
      delete data.meta.accent;
      onChange(true);
    });
    accentRow.append(reset);
  }
  palGroup.append(accentRow);
  pane.append(palGroup);

  pane.append(
    choiceRow(
      'Lettering',
      theme.fonts.map((f) => ({ value: f.id, name: f.name })),
      data.meta.fontId,
      (v) => {
        data.meta.fontId = v;
        onChange(true);
      },
    ),
  );
  // Show real letterforms on the font buttons
  for (const [i, btn] of [...pane.querySelectorAll('[aria-label="Lettering"] .font-choice')].entries()) {
    const font = theme.fonts[i];
    if (!font) continue;
    const sample = el('span', { class: 'font-sample', text: 'Aa' });
    sample.style.fontFamily = font.headingStack ?? font.stack;
    btn.prepend(sample);
  }

  if (data.photo) {
    pane.append(
      choiceRow<PhotoShape>(
        'Photo shape',
        [
          { value: 'circle', name: 'Circle' },
          { value: 'rounded', name: 'Rounded' },
          { value: 'square', name: 'Square' },
        ],
        data.meta.photoShape ?? theme.photoShape,
        (v) => {
          data.meta.photoShape = v;
          onChange(true);
        },
      ),
    );
  }

  pane.append(
    choiceRow(
      'Text size',
      [
        { value: 's', name: 'Compact' },
        { value: 'm', name: 'Normal' },
        { value: 'l', name: 'Large' },
      ],
      data.meta.textScale ?? 'm',
      (v) => {
        data.meta.textScale = v;
        onChange(true);
      },
    ),
    choiceRow(
      'Page width',
      [
        { value: 'narrow', name: 'Narrow' },
        { value: 'normal', name: 'Normal' },
        { value: 'wide', name: 'Wide' },
      ],
      data.meta.width ?? 'normal',
      (v) => {
        data.meta.width = v;
        onChange(true);
      },
    ),
  );

  // Feel: section surface + its corners/shadow, spacing density
  const surfaceRow = choiceRow<'theme' | 'card' | 'flat' | 'bordered' | 'tinted'>(
    'Sections',
    [
      { value: 'theme', name: "Theme's own" },
      { value: 'card', name: 'Cards' },
      { value: 'flat', name: 'Flat' },
      { value: 'bordered', name: 'Bordered' },
      { value: 'tinted', name: 'Tinted' },
    ],
    data.meta.surface ?? 'theme',
    (v) => {
      if (v === 'theme') delete data.meta.surface;
      else data.meta.surface = v;
      onChange(true);
    },
  );
  pane.append(surfaceRow);

  if (data.meta.surface && data.meta.surface !== 'flat') {
    pane.append(
      choiceRow(
        'Corners',
        [
          { value: 'sharp', name: 'Sharp' },
          { value: 'soft', name: 'Soft' },
          { value: 'round', name: 'Round' },
        ],
        data.meta.corners ?? 'soft',
        (v) => {
          data.meta.corners = v;
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
        data.meta.shadow ?? 'soft',
        (v) => {
          data.meta.shadow = v;
          onChange(true);
        },
      ),
    );
  }

  pane.append(
    choiceRow(
      'Spacing',
      [
        { value: 'compact', name: 'Compact' },
        { value: 'normal', name: 'Normal' },
        { value: 'airy', name: 'Airy' },
      ],
      data.meta.density ?? 'normal',
      (v) => {
        data.meta.density = v;
        onChange(true);
      },
    ),
  );

  // v2b: headings, hero alignment, photo size
  pane.append(
    choiceRow<'theme' | 'underline' | 'highlight' | 'caps'>(
      'Headings',
      [
        { value: 'theme', name: "Theme's own" },
        { value: 'underline', name: 'Underlined' },
        { value: 'highlight', name: 'Highlighted' },
        { value: 'caps', name: 'All caps' },
      ],
      data.meta.headingStyle ?? 'theme',
      (v) => {
        if (v === 'theme') delete data.meta.headingStyle;
        else data.meta.headingStyle = v;
        onChange(true);
      },
    ),
    choiceRow<'theme' | 'center' | 'left'>(
      'Top of the page',
      [
        { value: 'theme', name: "Theme's own" },
        { value: 'center', name: 'Centered' },
        { value: 'left', name: 'Left' },
      ],
      data.meta.heroAlign ?? 'theme',
      (v) => {
        if (v === 'theme') delete data.meta.heroAlign;
        else data.meta.heroAlign = v;
        onChange(true);
      },
    ),
  );
  if (data.photo) {
    pane.append(
      choiceRow<'s' | 'theme' | 'l'>(
        'Photo size',
        [
          { value: 's', name: 'Small' },
          { value: 'theme', name: "Theme's own" },
          { value: 'l', name: 'Large' },
        ],
        data.meta.photoSize ?? 'theme',
        (v) => {
          if (v === 'theme') delete data.meta.photoSize;
          else data.meta.photoSize = v;
          onChange(true);
        },
      ),
    );
  }

  // v2c: background treatment + auto dark mode
  pane.append(
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
      data.meta.background ?? 'theme',
      (v) => {
        if (v === 'theme') delete data.meta.background;
        else data.meta.background = v;
        onChange(true);
      },
    ),
  );

  const dark = darkestPalette(theme);
  const currentPalette = theme.palettes.find((p) => p.id === data.meta.paletteId);
  if (dark && currentPalette && dark.id !== currentPalette.id) {
    const wrap = el('div', { class: 'group' });
    const label = el('label', { class: 'check-row' });
    const box = el('input', { type: 'checkbox' });
    box.checked = Boolean(data.meta.autoDark);
    box.addEventListener('change', () => {
      if (box.checked) data.meta.autoDark = true;
      else delete data.meta.autoDark;
      onChange();
    });
    label.append(box, el('span', { text: `Follow dark mode (visitors with dark mode see the ${dark.name} colors)` }));
    wrap.append(label);
    pane.append(wrap);
  }

  // Vibes: one-tap bundles of the above; everything stays adjustable after
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
      for (const key of STYLE_KEYS) delete data.meta[key];
      Object.assign(data.meta, vibe.set);
      onChange(true);
    });
    vibeRow.append(chip);
  }
  const clearVibe = el('button', { type: 'button', class: 'chip', text: 'Reset to theme' });
  clearVibe.addEventListener('click', () => {
    for (const key of STYLE_KEYS) delete data.meta[key];
    delete data.meta.textScale;
    delete data.meta.width;
    delete data.meta.photoSize;
    delete data.meta.accent;
    onChange(true);
  });
  vibeRow.append(clearVibe);
  vibes.append(vibeRow);
  pane.append(vibes);

  // #9 slice 2: full color designer (advanced door)
  const designer = el('details', { class: 'group designer' });
  designer.append(el('summary', { text: 'Design your own colors (advanced)' }));
  designer.open = Boolean(data.meta.customPalette);
  const basePalette = theme.palettes.find((p) => p.id === data.meta.paletteId) ?? theme.palettes[0]!;
  const current = data.meta.customPalette ?? {
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
      data.meta.customPalette = { ...current };
      onChange();
    });
    input.addEventListener('change', () => onChange(true));
    cell.append(input, el('span', { class: 'hint', text: label }));
    designRow.append(cell);
  }
  designer.append(designRow);
  if (data.meta.customPalette) {
    const clear = el('button', { type: 'button', class: 'chip', text: 'Back to theme colors' });
    clear.addEventListener('click', () => {
      delete data.meta.customPalette;
      onChange(true);
    });
    designer.append(clear);
  }
  pane.append(designer);

  // #9 slice 3: share a look as a small file
  const portRow = el('div', { class: 'chips-row' });
  const exportBtn = el('button', { type: 'button', class: 'chip', text: 'Export this look (.json)' });
  exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ pageforgeTheme: 1, meta: data.meta }, null, 2)], {
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
      const parsed = JSON.parse(await file.text()) as { pageforgeTheme?: number; meta?: SiteData['meta'] };
      if (parsed.pageforgeTheme !== 1 || typeof parsed.meta?.themeId !== 'string') throw new Error('shape');
      data.meta = parsed.meta;
      onChange(true);
    } catch {
      portRow.append(el('span', { class: 'error', text: 'That does not look like a pageforge look file.' }));
    }
  });
  portRow.append(exportBtn, importBtn, importInput);
  pane.append(portRow);

  // #9 slice 1: freeze the current look as a reusable named theme
  const saveLook = el('button', { type: 'button', class: 'chip', text: 'Save this look as your own theme' });
  saveLook.addEventListener('click', () => {
    const name = prompt('Name your theme:', 'My look');
    if (!name?.trim()) return;
    saveMyTheme(name.trim().slice(0, 40), data.meta);
    saveLook.textContent = `Saved "${name.trim().slice(0, 40)}" - find it on the Look step`;
    setTimeout(() => {
      saveLook.textContent = 'Save this look as your own theme';
    }, 2500);
  });
  pane.append(el('div', { class: 'row' }, saveLook));

  const surprise = el('button', { type: 'button', class: 'chip', text: 'Surprise me' });
  surprise.addEventListener('click', () => {
    surpriseCounter += 1;
    const combos: { paletteId: string; fontId: string }[] = [];
    for (const p of theme.palettes) for (const f of theme.fonts) combos.push({ paletteId: p.id, fontId: f.id });
    const pick = combos[surpriseCounter % combos.length]!;
    data.meta.paletteId = pick.paletteId;
    data.meta.fontId = pick.fontId;
    delete data.meta.accent;
    onChange(true);
  });
  pane.append(surprise);
}
