import { renderSite } from '../../src/engine/render.js';
import type { SiteData, ThemePack } from '../../src/engine/types.js';
import full from '../fixtures/full.json';
import { loadPage, requiredRatio, textSamples, toHex, worstContrast } from './rendered-style.js';

export type Meta = SiteData['meta'];

/**
 * Render the full fixture with `meta` and return one line per piece of text
 * that misses WCAG AA against the background it actually sits on.
 */
export function contrastFailures(theme: ThemePack, meta: Partial<Meta>): string[] {
  const data = {
    ...(full as SiteData),
    meta: { themeId: theme.id, paletteId: theme.defaults.paletteId, fontId: theme.defaults.fontId, ...meta },
  } as SiteData;
  const { html, css } = renderSite(data, theme);
  const failures: string[] = [];
  for (const sample of textSamples(loadPage(html, css))) {
    const need = requiredRatio(sample);
    const { ratio, bg } = worstContrast(sample);
    if (ratio < need) {
      const tag = `${sample.el.tagName.toLowerCase()}${sample.el.className ? `.${String(sample.el.className).split(' ').join('.')}` : ''}`;
      failures.push(`${tag} "${sample.text}" ${toHex(sample.fg)} on ${toHex(bg)} = ${ratio.toFixed(2)} < ${need}`);
    }
  }
  return failures;
}
