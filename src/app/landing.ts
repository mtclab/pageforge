import type { SiteData } from '../engine/types.js';
import { THEMES } from '../themes/index.js';
import { el } from './dom.js';
import { previewHtml } from './preview.js';
import { STARTERS } from './starters.js';

/**
 * The landing page at "/". Its hero is the thing only pageforge has: every
 * look is a real page rendered live in the visitor's own browser by the same
 * engine that writes their zip - not a screenshot of one.
 *
 * The demo content is the "Personal page" starter, i.e. exactly what a visitor
 * gets if they click it in step 1. Nothing on this page is staged.
 */

/** The three sheets on the bench: editorial, loud, warm - the range in one glance,
    with the loudest on top where the eye lands. */
const HERO_LOOKS = ['gazette', 'ink', 'linen'];

function demoData(themeId: string): SiteData {
  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0]!;
  const base = structuredClone(STARTERS[0]!.data) as SiteData;
  return {
    ...base,
    photo: undefined,
    meta: { themeId: theme.id, paletteId: theme.defaults.paletteId, fontId: theme.defaults.fontId },
  };
}

/** Renders the frame only once it is close to the viewport - 15 live pages is a lot to boot. */
function lazyFrame(frame: HTMLIFrameElement, themeId: string): void {
  const paint = () => { frame.srcdoc = previewHtml(demoData(themeId)); };
  if (!('IntersectionObserver' in window)) {
    paint();
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      io.disconnect();
      paint();
    }
  }, { rootMargin: '400px' });
  io.observe(frame);
}

function heroSheets(host: HTMLElement): void {
  for (const id of HERO_LOOKS) {
    const theme = THEMES.find((t) => t.id === id);
    if (!theme) continue;
    const frame = el('iframe', {
      class: 'sheet-frame',
      title: `${theme.name} example page`,
      tabindex: '-1',
      sandbox: 'allow-same-origin',
    });
    frame.srcdoc = previewHtml(demoData(id));
    host.append(
      el(
        'figure',
        { class: 'sheet' },
        el('span', { class: 'sheet-frame-wrap' }, frame),
        el('figcaption', { class: 'sheet-cap', text: theme.name }),
      ),
    );
  }
}

function lookGrid(host: HTMLElement): void {
  for (const theme of THEMES.filter((t) => !t.biz)) {
    const frame = el('iframe', {
      class: 'sheet-frame',
      title: `${theme.name} example page`,
      tabindex: '-1',
      'aria-hidden': 'true',
      sandbox: 'allow-same-origin',
    });
    lazyFrame(frame, theme.id);
    const card = el(
      'a',
      { class: 'look', href: `/make#look=${theme.id}` },
      el('span', { class: 'sheet-frame-wrap' }, frame),
      el('span', { class: 'look-name', text: theme.name }),
      el('span', { class: 'look-tagline', text: theme.tagline }),
    );
    host.append(card);
  }
}

const sheets = document.getElementById('hero-sheets');
if (sheets) heroSheets(sheets);
const grid = document.getElementById('look-grid');
if (grid) lookGrid(grid);
