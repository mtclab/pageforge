import type { SiteData } from '../engine/types.js';
import { el } from './dom.js';
import { previewHtml } from './preview.js';
import { loadState, saveState } from './state.js';

/**
 * Someone opened a share link: show their friend's page full-screen with a
 * "make your own" banner. Nothing was uploaded - the page renders locally
 * from the data in the URL.
 */
export function renderSharedView(data: SiteData): void {
  const name = data.name.trim() || 'Someone';
  const banner = el(
    'div',
    { class: 'share-banner' },
    el('span', { text: `${name}'s page, made with pageforge` }),
  );
  const actions = el('div', { class: 'share-actions' });
  const makeOwn = el('button', { type: 'button', class: 'primary', text: 'Make your own - free' });
  makeOwn.addEventListener('click', () => {
    location.hash = '';
    location.reload();
  });
  const editThis = el('button', { type: 'button', class: 'chip', text: 'Use as my starting point' });
  editThis.addEventListener('click', () => {
    const state = loadState();
    const hasContent = state.data.name.trim() || state.data.sections.length || state.data.links.length;
    if (hasContent && !confirm('Replace your saved draft with this page?')) return;
    state.data = data;
    state.step = 1;
    saveState(state);
    location.hash = '';
    location.reload();
  });
  actions.append(makeOwn, editThis);
  banner.append(actions);

  const frame = el('iframe', { class: 'share-frame', title: `${name}'s page` });
  frame.srcdoc = previewHtml(data);

  document.body.replaceChildren(banner, frame);
  document.body.classList.add('share-mode');
  document.title = `${name} - pageforge`;
}
