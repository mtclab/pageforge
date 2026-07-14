import { renderSite } from '../engine/render.js';
import { escAttr } from '../engine/escape.js';
import { collectImages, type SiteData } from '../engine/types.js';
import { getTheme } from '../themes/index.js';
import { validImageDataUrl } from './site-data.js';

/**
 * Self-contained preview document: stylesheet inlined, photo swapped to its
 * data URL (srcdoc iframes cannot resolve relative asset paths).
 */
export function previewHtml(data: SiteData): string {
  const shown: SiteData = data.name.trim()
    ? data
    : { ...data, name: 'Your Name' };
  const { html, css } = renderSite(shown, getTheme(data.meta.themeId));
  let doc = html.replace(
    '<link rel="stylesheet" href="style.css">',
    `<style>${css}</style>`,
  );
  for (const [path, dataUrl] of collectImages(shown)) {
    if (validImageDataUrl(dataUrl)) {
      doc = doc.replace(`src="${path}"`, `src="${escAttr(dataUrl)}"`);
    }
  }
  return doc;
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Debounced srcdoc update so typing stays fluid. */
export function schedulePreview(iframe: HTMLIFrameElement, data: SiteData): void {
  clearTimeout(timer);
  timer = setTimeout(() => {
    iframe.srcdoc = previewHtml(data);
  }, 120);
}
