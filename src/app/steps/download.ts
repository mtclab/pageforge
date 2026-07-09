import { el } from '../dom.js';
import { downloadZip } from '../zip.js';
import { clearDraft } from '../state.js';
import type { StepCtx } from './content.js';

const KOFI_URL = 'https://ko-fi.com/kolli94431';

export function renderDownloadStep(pane: HTMLElement, ctx: StepCtx): void {
  const { data, onChange } = ctx;
  pane.append(el('h2', { text: 'Your site is ready' }));
  pane.append(
    el('p', {
      class: 'step-intro',
      text: 'You get a zip file with your whole website inside - it is yours to keep and host anywhere.',
    }),
  );

  const btn = el('button', { type: 'button', class: 'primary big', text: 'Download your site (.zip)' });
  btn.addEventListener('click', () => downloadZip(data));
  if (!data.name.trim()) {
    btn.disabled = true;
    pane.append(el('p', { class: 'error', text: 'Add your name in step 1 first - it is the only required thing.' }));
  }
  pane.append(btn);

  const what = el('div', { class: 'group' }, el('h3', { text: 'What now?' }));
  const steps = el('ol', { class: 'what-now' });
  steps.append(
    el(
      'li',
      {},
      'Unzip the file. The folder inside is your website - double-click ',
      el('code', { text: 'index.html' }),
      ' to see it.',
    ),
    el(
      'li',
      {},
      'To put it online free in about 2 minutes: drag the folder onto ',
      linkEl('https://app.netlify.com/drop', 'netlify.com/drop'),
      '. Other free options too - see the README file inside the zip for step-by-step instructions.',
    ),
    el('li', {}, 'Keep the zip. The ', el('code', { text: 'site.json' }), ' file inside lets you edit your site here later.'),
  );
  what.append(steps);
  pane.append(what);

  const tip = el('p', { class: 'tip' }, 'This tool is free. If it made you smile, you can ', linkEl(KOFI_URL, 'buy me a coffee'), '.');
  pane.append(tip);

  const startOver = el('button', { type: 'button', class: 'chip danger', text: 'Start over (clears everything)' });
  startOver.addEventListener('click', () => {
    if (!confirm('Clear your draft and start from scratch?')) return;
    clearDraft();
    location.reload();
  });
  pane.append(el('div', { class: 'spacer' }), startOver);
}

function linkEl(href: string, text: string): HTMLAnchorElement {
  return el('a', { href, target: '_blank', rel: 'noopener', text });
}
