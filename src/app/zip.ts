import { buildSiteFiles, buildZip, zipFilename } from '../engine/bundle.js';
import type { SiteData } from '../engine/types.js';
import { getTheme } from '../themes/index.js';

/** Build the zip in memory and hand it to the browser as a download. */
export function downloadZip(data: SiteData): void {
  const files = buildSiteFiles(data, getTheme(data.meta.themeId));
  const zip = buildZip(files);
  const buf = new Uint8Array(zip).buffer as ArrayBuffer;
  const blob = new Blob([buf], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipFilename(data.name);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
