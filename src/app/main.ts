import { el } from './dom.js';
import { renderGallery } from './gallery.js';
import { decodeShare } from './share.js';
import { renderSharedView } from './shared-view.js';
import { schedulePreview } from './preview.js';
import { loadState, saveState, type AppState } from './state.js';
import { renderContentStep, type StepCtx } from './steps/content.js';
import { renderCustomizeStep } from './steps/customize.js';
import { renderDownloadStep } from './steps/download.js';
import { renderThemeStep } from './steps/theme.js';

const STEPS: { n: AppState['step']; label: string }[] = [
  { n: 1, label: 'You' },
  { n: 2, label: 'Look' },
  { n: 3, label: 'Style' },
  { n: 4, label: 'Download' },
];

function initWizard(): void {
  const state = loadState();

  const pane = document.getElementById('pane')!;
  const stepNav = document.getElementById('steps')!;
  const iframe = document.getElementById('preview-frame') as HTMLIFrameElement;
  const prevBtn = document.getElementById('prev') as HTMLButtonElement;
  const nextBtn = document.getElementById('next') as HTMLButtonElement;

  // "Draft saved" pulse: autosave is invisible otherwise, and invisible
  // safety reads as no safety.
  const savedNote = el('span', { class: 'saved-note', text: 'Draft saved', 'aria-hidden': 'true' });
  document.querySelector('.topbar')?.insertBefore(savedNote, document.getElementById('preview-toggle'));
  let savedTimer: ReturnType<typeof setTimeout> | undefined;
  function pulseSaved(): void {
    savedNote.classList.add('show');
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => savedNote.classList.remove('show'), 1200);
  }

  // App-level undo/redo: snapshots of the whole draft, rapid typing coalesced
  const undoBtn = document.getElementById('undo') as HTMLButtonElement;
  const redoBtn = document.getElementById('redo') as HTMLButtonElement;
  const history: string[] = [JSON.stringify(state.data)];
  let hIndex = 0;
  let lastPush = 0;
  function updateUndoButtons(): void {
    undoBtn.disabled = hIndex === 0;
    redoBtn.disabled = hIndex === history.length - 1;
  }
  function recordHistory(): void {
    const snap = JSON.stringify(state.data);
    if (snap === history[hIndex]) return;
    const now = performance.now();
    if (now - lastPush < 800 && hIndex === history.length - 1 && hIndex > 0) {
      history[hIndex] = snap; // coalesce keystrokes into one step
    } else {
      history.splice(hIndex + 1);
      history.push(snap);
      if (history.length > 60) history.shift();
      hIndex = history.length - 1;
    }
    lastPush = now;
    updateUndoButtons();
  }
  function restore(idx: number): void {
    if (idx < 0 || idx > history.length - 1) return;
    hIndex = idx;
    lastPush = 0;
    state.data = JSON.parse(history[idx]!) as typeof state.data;
    ctx.data = state.data;
    saveState(state);
    schedulePreview(iframe, state.data);
    renderPane();
    updateUndoButtons();
  }
  undoBtn.addEventListener('click', () => restore(hIndex - 1));
  redoBtn.addEventListener('click', () => restore(hIndex + 1));
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
    e.preventDefault();
    restore(e.shiftKey ? hIndex + 1 : hIndex - 1);
  });

  const ctx: StepCtx = {
    data: state.data,
    onChange(structural = false) {
      ctx.data = state.data;
      saveState(state);
      recordHistory();
      pulseSaved();
      schedulePreview(iframe, state.data);
      if (structural) renderPane();
    },
  };

  function goto(step: AppState['step']): void {
    state.step = step;
    saveState(state);
    renderPane();
    window.scrollTo({ top: 0 });
  }

  function renderStepNav(): void {
    stepNav.replaceChildren(
      ...STEPS.map(({ n, label }) => {
        const current = n === state.step;
        const btn = el('button', {
          type: 'button',
          class: `step-btn${current ? ' current' : ''}`,
          'aria-current': current ? 'step' : 'false',
        });
        btn.append(el('span', { class: 'step-num', text: String(n) }), el('span', { text: label }));
        btn.addEventListener('click', () => goto(n));
        return btn;
      }),
    );
  }

  function renderPane(): void {
    renderStepNav();
    pane.replaceChildren();
    switch (state.step) {
      case 1:
        renderContentStep(pane, ctx);
        break;
      case 2:
        renderThemeStep(pane, ctx);
        break;
      case 3:
        renderCustomizeStep(pane, ctx);
        break;
      case 4:
        renderDownloadStep(pane, ctx);
        break;
    }
    prevBtn.disabled = state.step === 1;
    nextBtn.hidden = state.step === 4;
    nextBtn.textContent = state.step === 3 ? 'Finish' : 'Next';
  }

  prevBtn.addEventListener('click', () => goto((state.step - 1) as AppState['step']));
  nextBtn.addEventListener('click', () => goto((state.step + 1) as AppState['step']));

  // Mobile: preview lives behind a toggle
  const previewPane = document.getElementById('preview-pane')!;
  const previewToggle = document.getElementById('preview-toggle') as HTMLButtonElement;
  previewToggle.addEventListener('click', () => {
    const open = previewPane.classList.toggle('open');
    previewToggle.setAttribute('aria-expanded', String(open));
    previewToggle.textContent = open ? 'Close preview' : 'Preview';
  });

  // Full-screen preview: the iframe fills the browser window, i.e. the
  // user's real screen - the honest answer to "how will it actually look".
  const fsToggle = document.getElementById('fullscreen-toggle') as HTMLButtonElement;
  function setFullscreen(on: boolean): void {
    previewPane.classList.toggle('fullscreen', on);
    document.body.classList.toggle('no-scroll', on);
    fsToggle.setAttribute('aria-pressed', String(on));
    fsToggle.textContent = on ? 'Exit full screen' : 'Full screen';
  }
  fsToggle.addEventListener('click', () => setFullscreen(!previewPane.classList.contains('fullscreen')));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && previewPane.classList.contains('fullscreen')) setFullscreen(false);
  });

  // Desktop preview width toggle
  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-width]')) {
    btn.addEventListener('click', () => {
      iframe.classList.toggle('narrow', btn.dataset.width === 'mobile');
      for (const b of document.querySelectorAll('[data-width]')) {
        b.setAttribute('aria-pressed', String(b === btn));
      }
    });
  }

  renderPane();
  schedulePreview(iframe, state.data);
}

const sharedData = decodeShare(location.hash);
if (location.hash === '#gallery') {
  renderGallery();
} else if (sharedData) {
  renderSharedView(sharedData);
} else {
  initWizard();
}
