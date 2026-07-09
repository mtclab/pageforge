import { THEMES } from '../../themes/index.js';
import { el } from '../dom.js';
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
      meta: { themeId: theme.id, paletteId: theme.defaults.paletteId, fontId: theme.defaults.fontId },
    });
    card.append(
      el('span', { class: 'mini-wrap' }, frame),
      el('span', { class: 'theme-name', text: theme.name }),
      el('span', { class: 'theme-tagline', text: theme.tagline }),
    );
    card.addEventListener('click', () => {
      data.meta = {
        themeId: theme.id,
        paletteId: theme.defaults.paletteId,
        fontId: theme.defaults.fontId,
      };
      onChange(true);
    });
    grid.append(card);
  }
  pane.append(grid);
}
