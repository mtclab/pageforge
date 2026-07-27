import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Phone gates.
 *
 * Measured 2026-07-27 on the staging box at a 390px viewport: the document
 * scrolled to 484px. 94px of the builder - the remove/reorder buttons, the
 * right edge of every field, the preview button - sat off-screen, and the step
 * nav had dropped its words so "1 2 3 4" was all you got. The cause was never
 * the two-pane grid (that already collapsed at 60rem); it was min-content:
 * an unwrapped .row of two 8rem-min inputs plus three icon buttons, and a
 * topbar that could not wrap.
 *
 * happy-dom has no layout engine, so these assert the CSS rules that hold
 * min-content inside a phone. Revert any one of them and the overflow returns,
 * so each assertion has teeth. The measured proof lives beside them: the
 * Playwright probe in the session record, re-run at 390px after every change.
 */

const CSS_PATH = fileURLToPath(new URL('../src/app/ui.css', import.meta.url));
const css = readFileSync(CSS_PATH, 'utf8');

/** Splits the sheet into the top level plus each @media block, keeping its condition. */
function blocks(source: string): { media: string; body: string }[] {
  const out: { media: string; body: string }[] = [];
  let top = '';
  let i = 0;
  while (i < source.length) {
    const at = source.indexOf('@media', i);
    if (at === -1) {
      top += source.slice(i);
      break;
    }
    top += source.slice(i, at);
    const open = source.indexOf('{', at);
    const media = source.slice(at + 6, open).trim();
    let depth = 0;
    let j = open;
    for (; j < source.length; j++) {
      if (source[j] === '{') depth++;
      else if (source[j] === '}' && --depth === 0) break;
    }
    out.push({ media, body: source.slice(open + 1, j) });
    i = j + 1;
  }
  out.unshift({ media: '', body: top });
  return out;
}

/** Flat rules inside a block: `selector { declarations }`. */
function rules(body: string): { selector: string; decls: string }[] {
  return [...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1]!.replace(/\/\*[\s\S]*?\*\//g, '').trim(),
    decls: m[2]!,
  }));
}

const all = blocks(css);
const phone = all.find((b) => /max-width:\s*60rem/.test(b.media));

/** A rule that survives on a phone: it is not inside a wider-than-phone media query. */
function appliesOnPhone(media: string): boolean {
  const min = media.match(/min-width:\s*([\d.]+)(rem|px)/);
  if (!min) return true;
  const px = min[2] === 'rem' ? Number(min[1]) * 16 : Number(min[1]);
  return px <= 390;
}

describe('the builder fits a 390px phone', () => {
  it('has a phone breakpoint at or above 900px', () => {
    expect(phone, 'ui.css must keep a max-width:60rem block').toBeDefined();
  });

  it('stacks the two-pane wizard', () => {
    const wizard = rules(phone!.body).find((r) => r.selector === '.wizard');
    expect(wizard?.decls).toMatch(/grid-template-columns:\s*1fr/);
  });

  it('wraps form rows instead of forcing 420px of min-content', () => {
    const phoneRules = rules(phone!.body);
    expect(phoneRules.find((r) => r.selector === '.row')?.decls).toMatch(/flex-wrap:\s*wrap/);
    expect(phoneRules.find((r) => r.selector === '.row input')?.decls).toMatch(/flex:\s*1 1 100%/);
    // and nothing anywhere may hand a flex child an un-shrinkable minimum
    const base = rules(all[0]!.body).find((r) => r.selector === '.row input');
    expect(base?.decls, '.row input must be allowed to shrink').toMatch(/min-width:\s*0/);
  });

  it('wraps the topbar rather than pushing its right end off-screen', () => {
    const phoneRules = rules(phone!.body);
    expect(phoneRules.find((r) => r.selector === '.topbar')?.decls).toMatch(/flex-wrap:\s*wrap/);
    const steps = phoneRules.find((r) => r.selector === '.steps')?.decls ?? '';
    expect(steps, 'the step nav needs its own row').toMatch(/flex:\s*1 0 100%/);
    expect(steps, 'and a scroll escape hatch so it can never widen the page').toMatch(/overflow-x:\s*auto/);
  });

  it('keeps the step words: "1 2 3 4" does not say where you are', () => {
    for (const block of all) {
      if (!appliesOnPhone(block.media)) continue;
      for (const rule of rules(block.body)) {
        if (!/\.step-btn\s+span/.test(rule.selector)) continue;
        expect(rule.decls, `${rule.selector} must not hide the step labels`).not.toMatch(/display:\s*none/);
      }
    }
  });

  it('declares no fixed width wider than a phone', () => {
    // The preview frame's "narrow" mode is a deliberate 390px device mock and
    // is overridden to 100% on phones; everything else must fit.
    const allowed = /\.narrow/;
    const wide: string[] = [];
    for (const block of all) {
      if (!appliesOnPhone(block.media)) continue;
      for (const rule of rules(block.body)) {
        if (allowed.test(rule.selector)) continue;
        for (const m of rule.decls.matchAll(/(?:^|[;\s])(min-width|width):\s*([\d.]+)px/g)) {
          if (Number(m[2]) > 390) wide.push(`${rule.selector} { ${m[1]}: ${m[2]}px }`);
        }
      }
    }
    expect(wide).toEqual([]);
  });

  it('never hides the symptom with overflow-x: hidden on the page', () => {
    for (const rule of rules(all[0]!.body)) {
      if (!/^(html|body)$/.test(rule.selector)) continue;
      expect(rule.decls).not.toMatch(/overflow-x:\s*hidden/);
    }
  });
});
