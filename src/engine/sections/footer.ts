import { esc } from '../escape.js';
import type { SiteData } from '../types.js';

export function renderFooter(data: SiteData, hosted = false): string {
  const parts: string[] = [];
  if (data.footerNote?.trim()) parts.push(esc(data.footerNote.trim()));
  parts.push('Made with <a href="https://pageforge.mtclab.net" rel="noopener">pageforge</a>');
  if (hosted) {
    parts.push(
      '<a href="https://github.com/mtclab/pageforge/issues/new?labels=report" rel="noopener">Report this page</a>',
    );
  }
  return `<footer>\n<p>${parts.join(' &middot; ')}</p>\n</footer>`;
}
