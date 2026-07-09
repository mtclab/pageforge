import { el } from './dom.js';
import { renderGallery } from './gallery.js';
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

  const ctx: StepCtx = {
    data: state.data,
    onChange(structural = false) {
      ctx.data = state.data;
      saveState(state);
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

if (location.hash === '#gallery') {
  renderGallery();
} else {
  initWizard();
}
