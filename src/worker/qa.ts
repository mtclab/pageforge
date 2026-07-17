import { TEL_URL_RE } from '../engine/escape.js';
import { jsonLdTime } from '../engine/jsonld.js';
import type { SiteData } from '../engine/types.js';
import type { ControlPlane, LaunchChecklistRecord, QaRun, Site } from './db.js';

export interface CheckResult {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
}

export const LAUNCH_CHECKLIST_ITEMS = [
  { id: 'copy_reviewed', label: 'FI-kieli tarkastettu' },
  { id: 'owner_facts_confirmed', label: 'yrittäjä vahvistanut tiedot' },
  { id: 'browser_check', label: 'selattu puhelimella ja koneella' },
  { id: 'domain_ready', label: 'domain-asiat kunnossa' },
] as const;

export type LaunchChecklistItemId = typeof LAUNCH_CHECKLIST_ITEMS[number]['id'];

interface QaContext {
  data: SiteData;
  html: string;
  cp: ControlPlane;
}

type QaCheck = {
  id: string;
  label: string;
  run(context: QaContext): boolean | string | Promise<boolean | string>;
};

function attr(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\u0060]+))`, 'i'));
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function tags(html: string, name?: string): string[] {
  const tag = name ? name.replaceAll('-', '\\-') : '[a-z][a-z0-9:-]*';
  return html.match(new RegExp(`<${tag}\\b[^>]*>`, 'gi')) ?? [];
}

function jsonLdObjects(html: string): Record<string, unknown>[] {
  const objects: Record<string, unknown>[] = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (attr(match[1] ?? '', 'type')?.toLowerCase() !== 'application/ld+json') continue;
    try {
      const parsed = JSON.parse(match[2] ?? '') as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) objects.push(parsed as Record<string, unknown>);
    } catch { /* The check reports malformed JSON-LD as missing. */ }
  }
  return objects;
}

function localBusiness(html: string): Record<string, unknown> | undefined {
  return jsonLdObjects(html).find((value) => value['@type'] === 'LocalBusiness');
}

function hrefAndImageSrc(html: string): { tag: string; value: string; imageData: boolean }[] {
  const found: { tag: string; value: string; imageData: boolean }[] = [];
  for (const tag of tags(html)) {
    const tagName = tag.match(/^<([a-z][a-z0-9:-]*)/i)?.[1]?.toLowerCase() ?? '';
    const href = attr(tag, 'href');
    if (href !== undefined) found.push({ tag: tagName, value: href.trim(), imageData: false });
    const src = tagName === 'img' ? attr(tag, 'src') : undefined;
    if (src !== undefined) found.push({ tag: tagName, value: src.trim(), imageData: /^data:/i.test(src.trim()) });
  }
  return found;
}

function allowedUrl(value: string, imageData: boolean): boolean {
  if (imageData) return /^data:image\/(?:jpeg|png|webp);/i.test(value);
  if (/^(?:https?:|mailto:)/i.test(value)) return true;
  if (/^tel:/i.test(value)) return TEL_URL_RE.test(value);
  return !/^[a-z][a-z0-9+.-]*:/i.test(value);
}

function hoursResult(data: SiteData): boolean | string {
  for (const section of data.sections) {
    if (section.kind !== 'hours') continue;
    for (const day of section.days) {
      if (day.closed) continue;
      const open = jsonLdTime(day.open);
      const close = jsonLdTime(day.close);
      if (!open || !close || open === close) return `Virheellinen aukioloaika: ${day.label || 'nimetön päivä'}`;
    }
  }
  return true;
}

function phoneResult(html: string): boolean | string {
  const phones = tags(html, 'a').map((tag) => attr(tag, 'href')).filter((url): url is string => /^tel:/i.test(url ?? ''));
  if (!phones.length) return true;
  const telephone = localBusiness(html)?.telephone;
  if (phones.some((url) => !TEL_URL_RE.test(url))) return 'Puhelinlinkki on virheellinen.';
  if (typeof telephone !== 'string' || phones.some((url) => url.slice(4) !== telephone)) return 'Puhelinlinkki ei vastaa JSON-LD-puhelinta.';
  return true;
}

async function photoResult(html: string, cp: ControlPlane): Promise<boolean | string> {
  const hashes = [...new Set([...html.matchAll(/\/img\/([a-f0-9]{64})(?=[^a-f0-9]|$)/gi)].map((match) => match[1]!.toLowerCase()))];
  const keys = hashes.map((hash) => `photos/${hash}`);
  const found = new Set(await cp.listExistingPhotoKeys(keys));
  const missing = hashes.filter((hash) => !found.has(`photos/${hash}`));
  return missing.length ? `Kuvametadata puuttuu: ${missing.join(', ')}` : true;
}

function headingsResult(html: string): boolean | string {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? '';
  const levels = [...main.matchAll(/<h([1-6])\b/gi)].map((match) => Number(match[1]));
  let previous = 1;
  for (const level of levels) {
    if (level > previous + 1) return `Otsikkotaso hyppää tasolta h${previous} tasolle h${level}.`;
    previous = level;
  }
  return true;
}

const QA_CHECKS: readonly QaCheck[] = [
  { id: 'facts.name', label: 'Yrityksen nimi', run: ({ data }) => data.name.trim() ? true : 'Nimi puuttuu.' },
  { id: 'facts.hours', label: 'Aukioloajat', run: ({ data }) => hoursResult(data) },
  { id: 'facts.phone', label: 'Puhelinnumero', run: ({ html }) => phoneResult(html) },
  {
    id: 'links.schemes', label: 'Linkkien osoitteet', run: ({ html }) => {
      const invalid = hrefAndImageSrc(html).find(({ value, imageData }) => !allowedUrl(value, imageData));
      return invalid ? `Kielletty osoite: ${invalid.value}` : true;
    },
  },
  { id: 'links.photos', label: 'Kuvien metadata', run: ({ html, cp }) => photoResult(html, cp) },
  {
    id: 'a11y.h1', label: 'Yksi pääotsikko', run: ({ html }) => {
      const count = tags(html, 'h1').length;
      return count === 1 ? true : `h1-otsikoita on ${count}.`;
    },
  },
  { id: 'a11y.headings', label: 'Otsikkotasot', run: ({ html }) => headingsResult(html) },
  {
    id: 'a11y.imgAlt', label: 'Kuvien alt-tekstit', run: ({ html }) => {
      const missing = tags(html, 'img').filter((tag) => attr(tag, 'alt') === undefined).length;
      return missing ? `Alt-attribuutti puuttuu ${missing} kuvasta.` : true;
    },
  },
  {
    id: 'a11y.lang', label: 'Sivun kieli', run: ({ html }) => {
      const root = tags(html, 'html')[0];
      return root && attr(root, 'lang') !== undefined ? true : 'html-elementin lang-attribuutti puuttuu.';
    },
  },
  {
    id: 'size.html', label: 'HTML-koko', run: ({ html }) => {
      const bytes = new TextEncoder().encode(html).byteLength;
      return bytes <= 256 * 1024 ? true : `HTML on ${bytes} tavua (enintään 262144).`;
    },
  },
  {
    id: 'size.sections', label: 'Osioiden määrä', run: ({ data }) =>
      data.sections.length <= 20 ? true : `Osioita on ${data.sections.length} (enintään 20).`,
  },
  {
    id: 'seo.jsonld', label: 'Yrityksen JSON-LD', run: ({ data, html }) => {
      const required = data.sections.some((section) => section.kind === 'hours' || section.kind === 'location');
      return !required || localBusiness(html) ? true : 'LocalBusiness JSON-LD puuttuu.';
    },
  },
  {
    id: 'seo.title', label: 'Sivun otsikko', run: ({ html }) => {
      const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
      return title ? true : 'title-elementti puuttuu tai on tyhjä.';
    },
  },
];

/** Run the fixed v1 QA table in stable order. Only the photo check reads D1. */
export async function runQaChecks(data: SiteData, html: string, cp: ControlPlane): Promise<CheckResult[]> {
  const context = { data, html, cp };
  return Promise.all(QA_CHECKS.map(async (check) => {
    const outcome = await check.run(context);
    return {
      id: check.id,
      label: check.label,
      passed: outcome === true,
      ...(typeof outcome === 'string' ? { detail: outcome } : {}),
    };
  }));
}

export interface PublishGateResult {
  passed: boolean;
  missing: string[];
}

interface PrefetchedPublishGate {
  run?: QaRun | null;
  checklist?: LaunchChecklistRecord[];
}

/** Publishing gates against a passed QA run for the exact selected version. */
export async function publishGate(
  cp: ControlPlane,
  site: Site,
  n: number,
  prefetched: PrefetchedPublishGate = {},
): Promise<PublishGateResult> {
  const [run, checked] = await Promise.all([
    prefetched.run === undefined ? cp.latestQaRun(site.id) : prefetched.run,
    prefetched.checklist === undefined ? cp.listLaunchChecklist(site.id) : prefetched.checklist,
  ]);
  const missing: string[] = [];
  if (!run || run.version !== n) missing.push(`QA-tarkistus versiolle ${n}`);
  else if (!run.passed) missing.push(`läpäisty QA-tarkistus versiolle ${n}`);
  const checkedIds = new Set(checked.map((entry) => entry.item));
  for (const item of LAUNCH_CHECKLIST_ITEMS) {
    if (!checkedIds.has(item.id)) missing.push(item.label);
  }
  return { passed: missing.length === 0, missing };
}

export function publishGateError(gate: PublishGateResult): string {
  return gate.passed ? '' : `Julkaisun ehdot puuttuvat: ${gate.missing.join('; ')}.`;
}
