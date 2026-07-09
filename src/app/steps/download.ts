import { publishEnabled } from '../config.js';
import { el } from '../dom.js';
import { renderPublishBox } from '../publish.js';
import { encodeShare } from '../share.js';
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
      'Put it online with any web host - free ones and links to their guides are listed in the README inside the zip and on the ',
      linkEl('help.html', 'help page'),
      '. Fastest: drag the folder onto ',
      linkEl('https://app.netlify.com/drop', 'netlify.com/drop'),
      '.',
    ),
    el('li', {}, 'Keep the zip. The ', el('code', { text: 'site.json' }), ' file inside lets you edit your site here later.'),
  );
  what.append(steps);
  pane.append(what);

  if (publishEnabled()) {
    if (data.name.trim()) pane.append(renderPublishBox(data));
  } else {
    pane.append(
      el(
        'p',
        { class: 'hint coming-soon' },
        el('span', { class: 'beta-tag', text: 'coming later' }),
        ' We can host it for you - one click, no account. Not open yet; for now the zip + a free host above gets you online in minutes.',
      ),
    );
  }

  // Share a preview without hosting anything
  const share = el('div', { class: 'group' }, el('h3', { text: 'Show it to someone first?' }));
  share.append(
    el('p', {
      class: 'hint',
      text: 'Copy a preview link and send it to a friend. The page travels inside the link itself - nothing is uploaded. Your photo is not included.',
    }),
  );
  const shareBtn = el('button', { type: 'button', class: 'chip', text: 'Copy preview link' });
  const shareMsg = el('span', { class: 'hint', text: '' });
  shareBtn.addEventListener('click', async () => {
    const url = encodeShare(data);
    try {
      await navigator.clipboard.writeText(url);
      shareMsg.textContent = 'Copied!';
    } catch {
      prompt('Copy this link:', url);
    }
  });
  share.append(el('div', { class: 'row' }, shareBtn, shareMsg));
  pane.append(share);

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
