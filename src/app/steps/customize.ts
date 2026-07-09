import { getTheme } from '../../themes/index.js';
import { el } from '../dom.js';
import type { StepCtx } from './content.js';

/** Deterministic "surprise me": walks palette x font combos in order. */
let surpriseCounter = 0;

export function renderCustomizeStep(pane: HTMLElement, ctx: StepCtx): void {
  const { data, onChange } = ctx;
  const theme = getTheme(data.meta.themeId);

  pane.append(el('h2', { text: 'Make it yours' }));
  pane.append(el('p', { class: 'step-intro', text: `Colors and lettering for the ${theme.name} look.` }));

  const palGroup = el('div', { class: 'group', role: 'radiogroup', 'aria-label': 'Colors' });
  palGroup.append(el('h3', { text: 'Colors' }));
  const swatches = el('div', { class: 'swatch-row' });
  for (const palette of theme.palettes) {
    const selected = data.meta.paletteId === palette.id;
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
      onChange(true);
    });
    swatches.append(btn);
  }
  palGroup.append(swatches);
  pane.append(palGroup);

  const fontGroup = el('div', { class: 'group', role: 'radiogroup', 'aria-label': 'Lettering' });
  fontGroup.append(el('h3', { text: 'Lettering' }));
  const fontRow = el('div', { class: 'swatch-row' });
  for (const font of theme.fonts) {
    const selected = data.meta.fontId === font.id;
    const btn = el('button', {
      type: 'button',
      class: `font-choice${selected ? ' selected' : ''}`,
      role: 'radio',
      'aria-checked': String(selected),
    });
    const sample = el('span', { class: 'font-sample', text: 'Aa' });
    sample.style.fontFamily = font.headingStack ?? font.stack;
    btn.append(sample, el('span', { text: font.name }));
    btn.addEventListener('click', () => {
      data.meta.fontId = font.id;
      onChange(true);
    });
    fontRow.append(btn);
  }
  fontGroup.append(fontRow);
  pane.append(fontGroup);

  const surprise = el('button', { type: 'button', class: 'chip', text: 'Surprise me' });
  surprise.addEventListener('click', () => {
    surpriseCounter += 1;
    const combos: { paletteId: string; fontId: string }[] = [];
    for (const p of theme.palettes) for (const f of theme.fonts) combos.push({ paletteId: p.id, fontId: f.id });
    const pick = combos[surpriseCounter % combos.length]!;
    data.meta.paletteId = pick.paletteId;
    data.meta.fontId = pick.fontId;
    onChange(true);
  });
  pane.append(surprise);
}
