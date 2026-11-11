import { Window } from 'happy-dom';
import { contrast as hexContrast } from '../../src/engine/color.js';

/**
 * Render a generated page into a non-fetching DOM and read what each piece of
 * text actually looks like: its colour, the background it sits on, its size.
 *
 * happy-dom does the cascade (selectors, specificity, inheritance, var()), but
 * it does not compute color-mix(), gradients or calc()/clamp(). So the
 * stylesheet is first resolved here: every var() is substituted from :root and
 * every color-mix(in srgb, ...) is evaluated to rgba(); sizes are evaluated
 * from the computed calc()/clamp() strings at a phone viewport.
 */

export type RGBA = [number, number, number, number];

const PHONE_VW = 3.75; // 1vw at a 375px viewport, in px
const ROOT_PX = 16;

// ------------------------------------------------------------------ colours
const NAMED: Record<string, RGBA> = {
  transparent: [0, 0, 0, 0],
  white: [255, 255, 255, 1],
  black: [0, 0, 0, 1],
};

export function parseColor(raw: string): RGBA | null {
  const v = raw.trim().toLowerCase();
  if (v in NAMED) return [...NAMED[v]!] as RGBA;
  let m = v.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/);
  if (m) {
    const n = parseInt(m[1]!, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, m[2] ? parseInt(m[2], 16) / 255 : 1];
  }
  m = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  if (m) return [parseInt(m[1]! + m[1], 16), parseInt(m[2]! + m[2], 16), parseInt(m[3]! + m[3], 16), 1];
  m = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return [Number(m[1]), Number(m[2]), Number(m[3]), a];
  }
  return null;
}

const fmt = ([r, g, b, a]: RGBA) => `rgba(${r.toFixed(3)}, ${g.toFixed(3)}, ${b.toFixed(3)}, ${a.toFixed(4)})`;

/** CSS Color 5 color-mix in srgb (premultiplied alpha, percentages normalised). */
function mix(a: RGBA, pa: number, b: RGBA, pb: number): RGBA {
  const sum = pa + pb;
  const scale = sum > 1 ? 1 / sum : 1;
  const wa = pa * scale;
  const wb = pb * scale;
  const alpha = a[3] * wa + b[3] * wb;
  const mult = sum < 1 ? sum : 1;
  if (alpha === 0) return [0, 0, 0, 0];
  const ch = (i: number) => (a[i]! * a[3] * wa + b[i]! * b[3] * wb) / alpha;
  return [ch(0), ch(1), ch(2), alpha * mult];
}

/**
 * Source-over composite of `top` onto an opaque `bottom`, quantised to the
 * 8-bit colour the browser actually paints.
 */
export function over(top: RGBA, bottom: RGBA): RGBA {
  const a = top[3];
  return [
    Math.round(top[0] * a + bottom[0] * (1 - a)),
    Math.round(top[1] * a + bottom[1] * (1 - a)),
    Math.round(top[2] * a + bottom[2] * (1 - a)),
    1,
  ];
}

const toHex = ([r, g, b]: RGBA) =>
  `#${[r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`;

export function contrastOf(fg: RGBA, bg: RGBA): number {
  return hexContrast(toHex(fg), toHex(bg));
}

// ------------------------------------------------------------- stylesheet
function splitTopLevel(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  parts.push(cur.trim());
  return parts;
}

/** Remove an at-rule block (with nested braces) whose prelude matches. */
function stripAtBlocks(css: string, prelude: RegExp): string {
  let out = css;
  for (;;) {
    const m = prelude.exec(out);
    if (!m) return out;
    let i = out.indexOf('{', m.index);
    let depth = 0;
    for (; i < out.length; i++) {
      if (out[i] === '{') depth++;
      else if (out[i] === '}' && --depth === 0) break;
    }
    out = out.slice(0, m.index) + out.slice(i + 1);
  }
}

/** var() substituted from the first :root block, color-mix() evaluated. */
export function resolveStylesheet(css: string): string {
  let sheet = stripAtBlocks(css, /@media print/);
  sheet = stripAtBlocks(sheet, /@media \(prefers-color-scheme: dark\)/);
  const root = sheet.match(/:root\s*\{([^}]*)\}/);
  const vars = new Map<string, string>();
  for (const m of (root?.[1] ?? '').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars.set(m[1]!, m[2]!.trim());
  for (let i = 0; i < 10 && sheet.includes('var(--'); i++) {
    sheet = sheet.replace(/var\((--[\w-]+)\)/g, (_, name: string) => vars.get(name) ?? `var(${name})`);
  }
  // innermost color-mix first
  const re = /color-mix\(\s*in srgb\s*,((?:[^()]|\([^()]*\))*)\)/;
  for (let guard = 0; guard < 2000; guard++) {
    const m = re.exec(sheet);
    if (!m) break;
    const [sa, sb] = splitTopLevel(m[1]!);
    const pa = sa!.match(/^(.*?)\s+([\d.]+)%$/);
    const pb = sb!.match(/^(.*?)\s+([\d.]+)%$/);
    const ca = parseColor(pa ? pa[1]! : sa!);
    const cb = parseColor(pb ? pb[1]! : sb!);
    if (!ca || !cb) throw new Error(`unresolvable color-mix: ${m[0]}`);
    let wa = pa ? Number(pa[2]) / 100 : NaN;
    let wb = pb ? Number(pb[2]) / 100 : NaN;
    if (Number.isNaN(wa) && Number.isNaN(wb)) wa = wb = 0.5;
    else if (Number.isNaN(wa)) wa = 1 - wb;
    else if (Number.isNaN(wb)) wb = 1 - wa;
    sheet = sheet.slice(0, m.index) + fmt(mix(ca, wa, cb, wb)) + sheet.slice(m.index + m[0].length);
  }
  return sheet;
}

// ------------------------------------------------------------------ sizes
/** Evaluate a computed length (px/rem/em/vw, calc/clamp/min/max) to px. */
export function evalLength(expr: string, emPx: number): number {
  const src = expr.trim();
  let i = 0;
  const ws = () => { while (src[i] === ' ') i++; };
  function primary(): number {
    ws();
    if (src[i] === '(') { i++; const v = sum(); ws(); i++; return v; }
    const fn = /^(calc|clamp|min|max)\(/.exec(src.slice(i));
    if (fn) {
      i += fn[0].length;
      const args: number[] = [];
      for (;;) { args.push(sum()); ws(); if (src[i] === ',') { i++; continue; } i++; break; }
      if (fn[1] === 'calc') return args[0]!;
      if (fn[1] === 'min') return Math.min(...args);
      if (fn[1] === 'max') return Math.max(...args);
      return Math.min(Math.max(args[1]!, args[0]!), args[2]!);
    }
    const m = /^(-?[\d.]+)(px|rem|em|vw|%)?/.exec(src.slice(i));
    if (!m) throw new Error(`cannot evaluate length "${expr}" at ${i}`);
    i += m[0].length;
    const n = Number(m[1]);
    switch (m[2]) {
      case 'px': return n;
      case 'rem': return n * ROOT_PX;
      case 'em': return n * emPx;
      case '%': return (n / 100) * emPx;
      case 'vw': return n * PHONE_VW;
      default: return n;
    }
  }
  function product(): number {
    let v = primary();
    for (;;) { ws(); const op = src[i]; if (op !== '*' && op !== '/') return v; i++; const r = primary(); v = op === '*' ? v * r : v / r; }
  }
  function sum(): number {
    let v = product();
    for (;;) { ws(); const op = src[i]; if ((op !== '+' && op !== '-') || src[i + 1] !== ' ') return v; i++; const r = product(); v = op === '+' ? v + r : v - r; }
  }
  return sum();
}

// ------------------------------------------------------------------- page
/**
 * The computed properties the gate reads. happy-dom's getComputedStyle cannot
 * compute clamp()/vw sizes and costs ~1ms per element, so the cascade is done
 * here over the resolved stylesheet: selector matching is happy-dom's
 * Element.matches, specificity and source order decide, inherited properties
 * fall back to the parent.
 */
export interface Computed {
  color: string;
  backgroundColor: string;
  backgroundImage: string;
  backgroundSize: string;
  backgroundClip: string;
  textFillColor: string;
  opacity: string;
  fontWeight: string;
}

export interface RenderedPage {
  document: Document;
  style(el: Element): Computed;
  fontPx(el: Element): number;
}

interface Selector { sel: string; spec: number; tag: string | null; classes: string[] }
interface Rule { selectors: Selector[]; decls: Map<string, string> }

/** Cheap pre-check on the subject compound (tag + classes) before Element.matches. */
function mayMatch(el: Element, s: Selector): boolean {
  if (s.tag && s.tag !== el.tagName) return false;
  for (const c of s.classes) if (!el.classList.contains(c)) return false;
  return true;
}

function toSelector(sel: string): Selector {
  const subject = sel.split(/[\s>+~]+/).filter(Boolean).pop() ?? '';
  const bare = subject.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '');
  const tag = /^[a-z][\w-]*/i.exec(bare)?.[0]?.toUpperCase() ?? null;
  const classes = [...bare.matchAll(/\.([\w-]+)/g)].map((m) => m[1]!);
  return { sel, spec: specificity(sel), tag, classes };
}

const INHERITED = new Set(['color', 'font-weight', '-webkit-text-fill-color', 'font-size']);
const BOLD_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'B', 'STRONG', 'TH', 'DT']);

const parserWindow = new Window({
  settings: {
    disableCSSFileLoading: true,
    disableJavaScriptFileLoading: true,
    disableJavaScriptEvaluation: true,
    disableIframePageLoading: true,
  },
});

export function loadPage(html: string, css: string): RenderedPage {
  const document = new parserWindow.DOMParser().parseFromString(html, 'text/html') as unknown as Document;
  const rules = parseRules(resolveStylesheet(css));
  const declared = new Map<Element, Map<string, string>>();
  /** The cascaded (not inherited) value of every property set on el. */
  const cascaded = (el: Element): Map<string, string> => {
    const hit = declared.get(el);
    if (hit) return hit;
    const winners = new Map<string, { spec: number; order: number; value: string }>();
    rules.forEach((rule, order) => {
      let spec = -1;
      for (const s of rule.selectors) {
        if (s.spec <= spec || !mayMatch(el, s)) continue;
        let ok = false;
        try { ok = el.matches(s.sel); } catch { ok = false; }
        if (ok && s.spec > spec) spec = s.spec;
      }
      if (spec < 0) return;
      for (const [prop, value] of rule.decls) {
        const cur = winners.get(prop);
        if (!cur || spec > cur.spec || (spec === cur.spec && order > cur.order)) winners.set(prop, { spec, order, value });
      }
    });
    const out = new Map([...winners].map(([k, v]) => [k, v.value]));
    declared.set(el, out);
    return out;
  };
  const computedProp = (el: Element, prop: string): string => {
    const value = cascaded(el).get(prop);
    const parent = el.parentElement;
    if (value === undefined || value === 'inherit' || (prop === 'color' && value === 'currentcolor')) {
      if (INHERITED.has(prop) || value === 'inherit' || value === 'currentcolor') {
        if (parent) return computedProp(parent, prop);
      }
      if (prop === 'font-weight' && BOLD_TAGS.has(el.tagName)) return '700';
      return '';
    }
    if (prop === 'font-weight' && value === 'bolder') return '700';
    return value;
  };
  const styles = new Map<Element, Computed>();
  const style = (el: Element): Computed => {
    let snap = styles.get(el);
    if (!snap) {
      const fw = computedProp(el, 'font-weight') || (BOLD_TAGS.has(el.tagName) ? '700' : '400');
      snap = {
        color: computedProp(el, 'color') || '#000000',
        backgroundColor: computedProp(el, 'background-color') || 'transparent',
        backgroundImage: computedProp(el, 'background-image') || 'none',
        backgroundSize: computedProp(el, 'background-size') || 'auto',
        backgroundClip: computedProp(el, 'background-clip') || computedProp(el, '-webkit-background-clip'),
        textFillColor: computedProp(el, '-webkit-text-fill-color'),
        opacity: computedProp(el, 'opacity') || '1',
        fontWeight: fw === 'bold' ? '700' : fw === 'normal' ? '400' : fw,
      };
      styles.set(el, snap);
    }
    return snap;
  };
  const sizes = new Map<Element, number>();
  const fontPx = (el: Element): number => {
    const hit = sizes.get(el);
    if (hit !== undefined) return hit;
    const parent = el.parentElement;
    const parentPx = parent ? fontPx(parent) : ROOT_PX;
    const own = cascaded(el).get('font-size');
    const px = own && own !== 'inherit' ? evalLength(own, parentPx) : parentPx;
    sizes.set(el, px);
    return px;
  };
  return { document, style, fontPx };
}

/** Split on a separator outside parentheses. */
function splitOutside(s: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === sep && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  parts.push(cur);
  return parts;
}

/** `background` shorthand -> the colour and image longhands the gate needs. */
function expandBackground(value: string, into: Map<string, string>): void {
  const gradients = value.match(/(?:repeating-)?(?:linear|radial|conic)-gradient\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g) ?? [];
  let rest = value;
  for (const g of gradients) rest = rest.replace(g, ' ');
  const colour = (rest.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}\b|\b(?:transparent|white|black)\b/i) ?? [])[0];
  into.set('background-color', colour ?? 'transparent');
  into.set('background-image', gradients.length ? gradients.join(', ') : 'none');
}

/** Style rules that apply on a phone screen, in source order. */
function parseRules(sheet: string): Rule[] {
  let flat = sheet.replace(/\/\*[\s\S]*?\*\//g, '');
  flat = stripAtBlocks(flat, /@media \(prefers-reduced-motion[^)]*\)/);
  flat = stripAtBlocks(flat, /@keyframes [\w-]+/);
  // a 375px phone matches every (max-width: ...) block the themes use: unwrap them
  flat = flat.replace(/@media \(max-width:[^)]*\)\s*\{/g, '');
  const out: Rule[] = [];
  for (const m of flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = m[1]!.split(',').map((x) => x.trim())
      .filter((x) => x && !x.includes('::') && !x.startsWith('@') && !x.startsWith(':root'))
      .map(toSelector);
    if (!selectors.length) continue;
    const decls = new Map<string, string>();
    for (const d of splitOutside(m[2]!, ';')) {
      const at = d.indexOf(':');
      if (at < 0) continue;
      const prop = d.slice(0, at).trim().toLowerCase();
      const value = d.slice(at + 1).replace(/!important/, '').trim();
      if (!prop || !value) continue;
      if (prop === 'background') expandBackground(value, decls);
      else decls.set(prop, value);
    }
    if (decls.size) out.push({ selectors, decls });
  }
  return out;
}

/** Selector specificity as one comparable number (ids, classes, types). */
function specificity(sel: string): number {
  const s = sel.replace(/::[\w-]+/g, '');
  const ids = (s.match(/#[\w-]+/g) ?? []).length;
  const classes = (s.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+(\([^)]*\))?/g) ?? []).length;
  const types = (s.replace(/\[[^\]]*\]|\([^)]*\)/g, '').match(/(^|[\s>+~])[a-z][\w-]*/gi) ?? []).length;
  return ids * 10000 + classes * 100 + types;
}

/** Colour stops of a gradient value (rgba()/hex tokens inside it). */
function gradientStops(value: string): RGBA[] {
  return [...value.matchAll(/rgba?\([^)]*\)|#[0-9a-f]{3,8}\b|\btransparent\b/gi)]
    .map((m) => parseColor(m[0])!)
    .filter(Boolean);
}

/** Computed text colour, following inherit/currentcolor up the tree. */
function colorOf(el: Element, style: (e: Element) => Computed): RGBA {
  for (let e: Element | null = el; e; e = e.parentElement) {
    const c = parseColor(style(e).color || '');
    if (c) return c;
  }
  return [0, 0, 0, 1];
}

export interface TextSample {
  el: Element;
  text: string;
  fg: RGBA;
  /** Every background the text can sit on (one per gradient stop combination). */
  backgrounds: RGBA[];
  px: number;
  bold: boolean;
}

/**
 * Each element that directly owns visible text, with its colour and the
 * opaque background(s) under it - found by compositing every ancestor's
 * background (colour and gradient stops) from the page canvas down.
 */
export function textSamples(page: RenderedPage): TextSample[] {
  const { document, style } = page;
  const out: TextSample[] = [];
  // Backgrounds and opacity accumulated from the canvas down, memoised per element.
  const stack = new Map<Element, { layers: RGBA[]; opacity: number }>();
  const below = (el: Element): { layers: RGBA[]; opacity: number } => {
    const hit = stack.get(el);
    if (hit) return hit;
    const parent = el.parentElement;
    // the canvas under html is white; body's background paints over it
    let { layers, opacity } = parent ? below(parent) : { layers: [[255, 255, 255, 1]] as RGBA[], opacity: 1 };
    {
      const cs = style(el);
      const bgColor = parseColor(cs.backgroundColor || 'transparent') ?? [0, 0, 0, 0];
      // A gradient that fills the box is a background text sits on. A small
      // repeating tile (blueprint grid, dots/grid/lines options) is a hairline
      // pattern, not a surface: skipped.
      const tiled = /\d/.test(cs.backgroundSize || '') && !/cover|contain/.test(cs.backgroundSize || '');
      const bgImage = !tiled && cs.backgroundImage.includes('gradient(') ? cs.backgroundImage : '';
      const clipText = /text/.test(cs.backgroundClip || '');
      layers = layers.map((l) => over(bgColor, l));
      if (bgImage && !clipText) {
        const stops = gradientStops(bgImage);
        if (stops.length) layers = layers.flatMap((l) => stops.map((s) => over(s, l)));
      }
      const op = parseFloat(cs.opacity || '1');
      if (!Number.isNaN(op)) opacity *= op;
    }
    const result = { layers, opacity };
    stack.set(el, result);
    return result;
  };
  for (const el of [...document.querySelectorAll('body, body *')]) {
    if (el.closest('svg, script, style, template')) continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent ?? '').join('').trim();
    if (!own) continue;
    const { layers, opacity } = below(el);
    const cs = style(el);
    let fgs: RGBA[] = [colorOf(el, style)];
    const fill = cs.textFillColor;
    if (fill && parseColor(fill)?.[3] === 0) {
      // gradient-clipped text: the glyphs are painted with the element's own gradient
      fgs = gradientStops(cs.backgroundImage);
    }
    for (const fg of fgs) {
      const faded: RGBA = [fg[0], fg[1], fg[2], fg[3] * opacity];
      out.push({
        el,
        text: own.slice(0, 40),
        fg: faded,
        backgrounds: layers,
        px: page.fontPx(el),
        bold: Number(cs.fontWeight) >= 700 || cs.fontWeight === 'bold',
      });
    }
  }
  return out;
}

/** WCAG 2.x AA: 3:1 for large text (>= 24px, or >= 18.66px bold), else 4.5:1. */
export function requiredRatio(s: TextSample): number {
  return s.px >= 24 || (s.bold && s.px >= 18.66) ? 3 : 4.5;
}

/** Worst contrast of a sample over all its possible backgrounds. */
export function worstContrast(s: TextSample): { ratio: number; bg: RGBA } {
  let worst = { ratio: Infinity, bg: s.backgrounds[0]! };
  for (const bg of s.backgrounds) {
    const ratio = contrastOf(over(s.fg, bg), bg);
    if (ratio < worst.ratio) worst = { ratio, bg };
  }
  return worst;
}

export { toHex };
