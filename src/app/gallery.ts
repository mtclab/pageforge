import type { SiteData } from '../engine/types.js';
import { THEMES } from '../themes/index.js';
import { el } from './dom.js';
import { previewHtml } from './preview.js';
import sample from '../../test/fixtures/full.json';

/** Hidden theme workbench at /#gallery: every theme x palette against the full fixture. */
export function renderGallery(): void {
  document.body.replaceChildren(
    el('header', { class: 'topbar' }, el('div', { class: 'brand', text: 'pageforge gallery' })),
  );
  const grid = el('div', { class: 'gallery-grid' });
  for (const theme of THEMES) {
    for (const palette of theme.palettes) {
      const data: SiteData = {
        ...(sample as SiteData),
        photo: undefined,
        meta: { themeId: theme.id, paletteId: palette.id, fontId: theme.defaults.fontId },
      };
      const frame = el('iframe', {
        class: 'gallery-frame',
        title: `${theme.name} / ${palette.name}`,
        sandbox: 'allow-same-origin',
      });
      frame.srcdoc = previewHtml(data);
      grid.append(
        el(
          'figure',
          { class: 'gallery-cell' },
          frame,
          el('figcaption', { text: `${theme.name} / ${palette.name}` }),
        ),
      );
    }
  }
  document.body.append(grid);
  const style = el('style', {
    text: `
      .gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem; padding: 1rem; }
      .gallery-cell { margin: 0; }
      .gallery-frame { width: 100%; height: 480px; border: 1px solid var(--line); border-radius: 6px; background: #fff; }
      .gallery-cell figcaption { font-family: var(--mono); font-size: 0.8rem; color: var(--muted); margin-top: 0.3rem; }
    `,
  });
  document.head.append(style);
}
