import qrcode from 'qrcode-generator';
import { esc } from '../engine/escape.js';
import type { SiteData } from '../engine/types.js';

/** Deterministic QR of a URL as a scalable SVG string. */
export function qrSvg(url: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}

/**
 * Printable sheet of small cards (name, tagline, address + QR) - hand them
 * out at the event, pin one on the noticeboard. Opens the browser's print
 * dialog; no server, nothing uploaded.
 */
export function openPrintCards(data: SiteData, url: string): void {
  const svg = qrSvg(url);
  const name = esc(data.name.trim());
  const tagline = data.tagline?.trim() ? `<p class="t">${esc(data.tagline.trim())}</p>` : '';
  const card = `<div class="card"><div class="qr">${svg}</div><div class="txt"><h2>${name}</h2>${tagline}<p class="u">${esc(url)}</p></div></div>`;
  const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Print cards - ${name}</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: system-ui, sans-serif; padding: 10mm; }
  .sheet { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6mm; }
  .card {
    display: flex; gap: 5mm; align-items: center;
    border: 1px dashed #999; border-radius: 3mm; padding: 5mm;
    break-inside: avoid;
  }
  .qr svg { width: 28mm; height: 28mm; display: block; }
  h2 { font-size: 14pt; }
  .t { color: #555; font-size: 9pt; margin-top: 1mm; }
  .u { font-size: 8.5pt; margin-top: 2mm; word-break: break-all; }
  .hint { margin-bottom: 6mm; color: #555; font-size: 10pt; }
  @media print { .hint { display: none; } }
</style>
</head>
<body>
<p class="hint">Print this page (Ctrl+P). Cut along the dashed lines.</p>
<div class="sheet">${Array.from({ length: 10 }, () => card).join('')}</div>
<script>window.print();</script>
</body>
</html>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(doc);
  w.document.close();
}

/** Trigger a download of the QR as a standalone .svg file. */
export function downloadQr(url: string, slug: string): void {
  const blob = new Blob([qrSvg(url)], { type: 'image/svg+xml' });
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = `${slug || 'my-page'}-qr.svg`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}
