import { el } from './dom.js';
import type { StepCtx } from './steps/content.js';

const VIEW = 220; // on-screen crop viewport (CSS px)
const OUT = 512; // exported square JPEG size

/** Gallery photos: keep aspect, cap the long edge, re-encode as JPEG. */
export async function fileToResizedDataUrl(file: File, maxEdge = 1024): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.82);
}

/**
 * Photo field: pick -> zoom/pan crop -> square JPEG data URL in state.
 * Everything happens locally; the photo never leaves the browser.
 */
export function renderPhotoField(ctx: StepCtx): HTMLElement {
  const { data, onChange } = ctx;
  const wrap = el('div', { class: 'field' }, el('span', { class: 'label', text: 'Photo (optional)' }));

  if (data.photo) {
    const img = el('img', { class: 'photo-thumb', alt: 'Your chosen photo' });
    img.src = data.photo.dataUrl;
    const remove = el('button', { type: 'button', class: 'chip', text: 'Remove photo' });
    remove.addEventListener('click', () => {
      delete data.photo;
      onChange(true);
    });
    wrap.append(el('div', { class: 'row center' }, img, remove));
    return wrap;
  }

  const input = el('input', { type: 'file', accept: 'image/*', class: 'visually-hidden' });
  const pick = el('button', { type: 'button', class: 'chip', text: 'Add a photo' });
  pick.addEventListener('click', () => input.click());
  const note = el('p', { class: 'hint', text: 'Stays on your device until you download your site.' });
  const cropHost = el('div');
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      cropHost.replaceChildren(cropUi(bitmap, ctx));
      pick.hidden = true;
      note.hidden = true;
    } catch {
      cropHost.replaceChildren(
        el('p', { class: 'error', text: 'Sorry, that image could not be read. Try a different photo (JPG or PNG works best).' }),
      );
    }
  });
  wrap.append(pick, input, note, cropHost);
  return wrap;
}

function cropUi(bitmap: ImageBitmap, ctx: StepCtx): HTMLElement {
  const { data, onChange } = ctx;
  const box = el('div', { class: 'crop' });
  const canvas = el('canvas', { class: 'crop-canvas' });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = VIEW * dpr;
  canvas.height = VIEW * dpr;
  const g = canvas.getContext('2d')!;

  // cover-fit baseline, zoom multiplies it; offsets are in source pixels (center point)
  const coverScale = VIEW / Math.min(bitmap.width, bitmap.height);
  let zoom = 1;
  let cx = bitmap.width / 2;
  let cy = bitmap.height / 2;

  function clamp(): void {
    const half = VIEW / 2 / (coverScale * zoom); // half viewport in source px
    cx = Math.min(Math.max(cx, half), bitmap.width - half);
    cy = Math.min(Math.max(cy, half), bitmap.height - half);
  }

  function draw(target: CanvasRenderingContext2D, size: number): void {
    // source rect centered on (cx, cy), mapped onto a size x size output
    const srcHalf = VIEW / 2 / (coverScale * zoom);
    target.drawImage(
      bitmap,
      cx - srcHalf,
      cy - srcHalf,
      srcHalf * 2,
      srcHalf * 2,
      0,
      0,
      size,
      size,
    );
  }

  function repaint(): void {
    clamp();
    g.clearRect(0, 0, canvas.width, canvas.height);
    draw(g, canvas.width);
  }

  // drag to pan (pointer events cover mouse + touch)
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    cx -= (e.clientX - lastX) / (coverScale * zoom);
    cy -= (e.clientY - lastY) / (coverScale * zoom);
    lastX = e.clientX;
    lastY = e.clientY;
    repaint();
  });
  canvas.addEventListener('pointerup', () => {
    dragging = false;
  });

  const slider = el('input', { type: 'range', min: '1', max: '3', step: '0.01', value: '1', 'aria-label': 'Zoom' });
  slider.addEventListener('input', () => {
    zoom = Number(slider.value);
    repaint();
  });

  const use = el('button', { type: 'button', class: 'primary', text: 'Use this photo' });
  use.addEventListener('click', () => {
    const out = document.createElement('canvas');
    out.width = OUT;
    out.height = OUT;
    draw(out.getContext('2d')!, OUT);
    data.photo = { dataUrl: out.toDataURL('image/jpeg', 0.85) };
    bitmap.close();
    onChange(true);
  });
  const cancel = el('button', { type: 'button', class: 'chip', text: 'Cancel' });
  cancel.addEventListener('click', () => {
    bitmap.close();
    onChange(true);
  });

  repaint();
  box.append(
    canvas,
    el('p', { class: 'hint', text: 'Drag to move, slide to zoom.' }),
    slider,
    el('div', { class: 'row' }, use, cancel),
  );
  return box;
}
