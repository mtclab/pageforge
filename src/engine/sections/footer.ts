import { esc } from '../escape.js';
import type { SiteData } from '../types.js';

export function renderFooter(data: SiteData, hosted = false): string {
  const parts: string[] = [];
  if (data.footerNote?.trim()) parts.push(esc(data.footerNote.trim()));
  // One credit line, two marks: the tool people can go and use, and the estate
  // that made it (IDENTITY_SYSTEM.md s1.3 - the maker's mark is the constant
  // that proves same-hands). Kept to a single quiet clause: this footer sits on
  // someone else's website, not ours.
  parts.push(
    'Made with <a href="https://pageforge.mtclab.net" rel="noopener">pageforge</a>'
    + ' by <a href="https://mtclab.net" rel="noopener">MTC Lab</a>',
  );
  if (hosted) {
    parts.push(
      '<a href="https://github.com/mtclab/pageforge/issues/new?labels=report" rel="noopener">Report this page</a>',
    );
  }
  return `<footer>\n<p>${parts.join(' &middot; ')}</p>\n</footer>`;
}
