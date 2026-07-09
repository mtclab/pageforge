import { getTheme, THEMES } from '../../themes/index.js';
import { el } from '../dom.js';
import { applyMyTheme, deleteMyTheme, loadMyThemes } from '../mythemes.js';
import { previewHtml } from '../preview.js';
import type { StepCtx } from './content.js';

/**
 * Theme gallery: every card is the user's own data rendered with that theme,
 * scaled down in a real iframe.
 */
export function renderThemeStep(pane: HTMLElement, ctx: StepCtx): void {
  const { data, onChange } = ctx;
  pane.append(el('h2', { text: 'Pick a look' }));
  pane.append(
    el('p', { class: 'step-intro', text: 'Each preview shows your own page. You can fine-tune colors in the next step.' }),
  );
  const grid = el('div', { class: 'theme-grid', role: 'radiogroup', 'aria-label': 'Theme' });
  for (const theme of THEMES) {
    const selected = data.meta.themeId === theme.id;
    const card = el('button', {
      type: 'button',
      class: `theme-card${selected ? ' selected' : ''}`,
      role: 'radio',
      'aria-checked': String(selected),
    });
    const frame = el('iframe', {
      class: 'mini-preview',
      title: `${theme.name} preview`,
      tabindex: '-1',
      'aria-hidden': 'true',
      sandbox: 'allow-same-origin',
    });
    frame.srcdoc = previewHtml({
      ...data,
      meta: {
        ...data.meta,
        themeId: theme.id,
        paletteId: selected ? data.meta.paletteId : theme.defaults.paletteId,
        fontId: selected ? data.meta.fontId : theme.defaults.fontId,
      },
    });
    const dots = el('span', { class: 'palette-dots', role: 'group', 'aria-label': `${theme.name} color choices` });
    for (const palette of theme.palettes) {
      const active = selected && data.meta.paletteId === palette.id;
      const dot = el('span', {
        class: `palette-dot${active ? ' active' : ''}`,
        role: 'button',
        tabindex: '0',
        'aria-label': `${theme.name} in ${palette.name} colors`,
        title: palette.name,
      });
      dot.style.background = `linear-gradient(135deg, ${palette.vars.bg} 50%, ${palette.vars.accent} 50%)`;
      const pick = (e: Event) => {
        e.stopPropagation();
        data.meta = { ...data.meta, themeId: theme.id, paletteId: palette.id, fontId: theme.defaults.fontId };
        delete data.meta.accent;
        onChange(true);
      };
      dot.addEventListener('click', pick);
      dot.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') pick(e);
      });
      dots.append(dot);
    }

    card.append(
      el('span', { class: 'mini-wrap' }, frame),
      el('span', { class: 'theme-name' }, theme.name, dots),
      el('span', { class: 'theme-tagline', text: theme.tagline }),
    );
    card.addEventListener('click', () => {
      data.meta = {
        ...data.meta,
        themeId: theme.id,
        paletteId: theme.defaults.paletteId,
        fontId: theme.defaults.fontId,
      };
      onChange(true);
    });
    grid.append(card);
  }
  pane.append(grid);

  // #9 slice 1: user-saved looks
  const mine = loadMyThemes();
  if (mine.length) {
    pane.append(el('h3', { class: 'your-themes-h', text: 'Your themes' }));
    const myGrid = el('div', { class: 'theme-grid' });
    for (const mt of mine) {
      const active = JSON.stringify(data.meta) === JSON.stringify(mt.meta);
      const card = el('button', {
        type: 'button',
        class: `theme-card${active ? ' selected' : ''}`,
      });
      const frame = el('iframe', {
        class: 'mini-preview',
        title: `${mt.name} preview`,
        tabindex: '-1',
        'aria-hidden': 'true',
        sandbox: 'allow-same-origin',
      });
      frame.srcdoc = previewHtml({ ...data, meta: mt.meta });
      // span+role, not <button>: the card itself is a button and buttons cannot nest
      const del = el('span', {
        class: 'icon-btn',
        role: 'button',
        tabindex: '0',
        'aria-label': `Delete theme ${mt.name}`,
        text: '✕',
      });
      const doDelete = (e: Event) => {
        e.stopPropagation();
        if (!confirm(`Delete your theme "${mt.name}"?`)) return;
        deleteMyTheme(mt.id);
        onChange(true);
      };
      del.addEventListener('click', doDelete);
      del.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') doDelete(e);
      });
      card.append(
        el('span', { class: 'mini-wrap' }, frame),
        el('span', { class: 'theme-name' }, mt.name, del),
        el('span', { class: 'theme-tagline', text: `Based on ${getTheme(mt.meta.themeId).name}` }),
      );
      card.addEventListener('click', () => {
        applyMyTheme(data, mt);
        onChange(true);
      });
      myGrid.append(card);
    }
    pane.append(myGrid);
  }
}
