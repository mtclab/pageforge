import type { Link, LinkKind, Section, SiteData } from '../engine/types.js';
import { THEMES } from '../themes/index.js';

const IMAGE_BASE64_MAX = 1_100_000;
const LINK_KINDS: LinkKind[] = [
  'email', 'github', 'instagram', 'linkedin', 'youtube', 'facebook', 'x', 'phone', 'website',
];

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined | null {
  return value === undefined ? undefined : typeof value === 'string' ? value : null;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined | null {
  return value === undefined ? undefined : typeof value === 'string' && allowed.includes(value as T)
    ? value as T
    : null;
}

/** A JPEG/PNG data URL with sane base64, image signature and encoded size. */
export function validImageDataUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = value.match(/^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]*={0,2})$/);
  if (!match || !match[2] || match[2].length > IMAGE_BASE64_MAX || match[2].length % 4 === 1) {
    return false;
  }
  try {
    const padded = match[2].padEnd(Math.ceil(match[2].length / 4) * 4, '=');
    const bytes = atob(padded);
    if (match[1] === 'jpeg') {
      return bytes.length >= 3 && bytes.charCodeAt(0) === 0xff && bytes.charCodeAt(1) === 0xd8
        && bytes.charCodeAt(2) === 0xff;
    }
    return bytes.length >= 8
      && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
        .every((byte, i) => bytes.charCodeAt(i) === byte);
  } catch {
    return false;
  }
}

function decodeImage(value: unknown): { dataUrl: string } | undefined | null {
  if (value === undefined) return undefined;
  if (!isObject(value) || !validImageDataUrl(value.dataUrl)) return null;
  return { dataUrl: value.dataUrl };
}

function decodeLinks(value: unknown): Link[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const links: Link[] = [];
  for (const raw of value) {
    if (!isObject(raw) || typeof raw.label !== 'string' || typeof raw.url !== 'string') return null;
    const kind = oneOf(raw.kind, LINK_KINDS);
    if (kind === null) return null;
    links.push(kind === undefined ? { label: raw.label, url: raw.url } : { label: raw.label, url: raw.url, kind });
  }
  return links;
}

function decodeSections(value: unknown): Section[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const sections: Section[] = [];
  for (const raw of value) {
    if (!isObject(raw) || typeof raw.kind !== 'string') return null;
    const title = optionalString(raw.title);
    if (title === null) return null;
    switch (raw.kind) {
      case 'about':
        if (typeof raw.text !== 'string') return null;
        sections.push({ kind: 'about', text: raw.text });
        break;
      case 'projects': {
        if (raw.items !== undefined && !Array.isArray(raw.items)) return null;
        const items: Extract<Section, { kind: 'projects' }>['items'] = [];
        for (const item of raw.items ?? []) {
          if (!isObject(item) || typeof item.name !== 'string') return null;
          const desc = optionalString(item.desc);
          const url = optionalString(item.url);
          if (desc === null || url === null) return null;
          items.push({ name: item.name, ...(desc === undefined ? {} : { desc }), ...(url === undefined ? {} : { url }) });
        }
        sections.push({ kind: 'projects', ...(title === undefined ? {} : { title }), items });
        break;
      }
      case 'hobbies':
        if (raw.items !== undefined && (!Array.isArray(raw.items) || raw.items.some((item) => typeof item !== 'string'))) {
          return null;
        }
        sections.push({ kind: 'hobbies', ...(title === undefined ? {} : { title }), items: (raw.items ?? []) as string[] });
        break;
      case 'contact': {
        const email = optionalString(raw.email);
        const note = optionalString(raw.note);
        if (email === null || note === null) return null;
        sections.push({ kind: 'contact', ...(email === undefined ? {} : { email }), ...(note === undefined ? {} : { note }) });
        break;
      }
      case 'custom':
        if (typeof raw.title !== 'string' || typeof raw.text !== 'string') return null;
        sections.push({ kind: 'custom', title: raw.title, text: raw.text });
        break;
      case 'gallery': {
        if (raw.photos !== undefined && (!Array.isArray(raw.photos) || raw.photos.length > 6)) return null;
        const photos: { dataUrl: string }[] = [];
        for (const photo of raw.photos ?? []) {
          const decoded = decodeImage(photo);
          if (!decoded) return null;
          photos.push(decoded);
        }
        sections.push({ kind: 'gallery', ...(title === undefined ? {} : { title }), photos });
        break;
      }
      default:
        return null;
    }
  }
  return sections;
}

function defaultMeta(): SiteData['meta'] {
  const theme = THEMES[0]!;
  return {
    themeId: theme.id,
    paletteId: theme.defaults.paletteId,
    fontId: theme.defaults.fontId,
  };
}

/** Decode the complete style object; malformed optional overrides reject the input. */
export function decodeSiteMeta(value: unknown): SiteData['meta'] | null {
  if (value === undefined) return defaultMeta();
  if (!isObject(value)) return null;
  const fallback = defaultMeta();
  const themeId = value.themeId === undefined ? fallback.themeId : value.themeId;
  const paletteId = value.paletteId === undefined ? fallback.paletteId : value.paletteId;
  const fontId = value.fontId === undefined ? fallback.fontId : value.fontId;
  if (typeof themeId !== 'string' || typeof paletteId !== 'string' || typeof fontId !== 'string') return null;

  const photoShape = oneOf(value.photoShape, ['circle', 'rounded', 'square'] as const);
  const textScale = oneOf(value.textScale, ['s', 'm', 'l'] as const);
  const width = oneOf(value.width, ['narrow', 'normal', 'wide'] as const);
  const surface = oneOf(value.surface, ['card', 'flat', 'bordered', 'tinted'] as const);
  const corners = oneOf(value.corners, ['sharp', 'soft', 'round'] as const);
  const shadow = oneOf(value.shadow, ['none', 'soft', 'lifted'] as const);
  const density = oneOf(value.density, ['compact', 'normal', 'airy'] as const);
  const headingStyle = oneOf(value.headingStyle, ['underline', 'highlight', 'caps'] as const);
  const heroAlign = oneOf(value.heroAlign, ['left', 'center'] as const);
  const photoSize = oneOf(value.photoSize, ['s', 'l'] as const);
  const background = oneOf(value.background, ['dots', 'grid', 'lines', 'wash-top', 'wash-corner'] as const);
  if (photoShape === null || textScale === null || width === null || surface === null
    || corners === null || shadow === null || density === null || headingStyle === null
    || heroAlign === null || photoSize === null || background === null) return null;
  if (value.autoDark !== undefined && typeof value.autoDark !== 'boolean') return null;
  if (value.hideBranding !== undefined && typeof value.hideBranding !== 'boolean') return null;

  let accent: string | undefined;
  if (value.accent !== undefined) {
    if (typeof value.accent !== 'string' || !/^#[0-9a-f]{6}$/i.test(value.accent)) return null;
    accent = value.accent.toLowerCase();
  }
  let customPalette: SiteData['meta']['customPalette'];
  if (value.customPalette !== undefined) {
    if (!isObject(value.customPalette)) return null;
    const rawPalette = value.customPalette;
    const keys = ['bg', 'surface', 'text', 'muted', 'accent'] as const;
    if (keys.some((key) => typeof rawPalette[key] !== 'string'
      || !/^#[0-9a-f]{6}$/i.test(rawPalette[key] as string))) return null;
    customPalette = Object.fromEntries(
      keys.map((key) => [key, (rawPalette[key] as string).toLowerCase()]),
    ) as NonNullable<SiteData['meta']['customPalette']>;
  }

  return {
    themeId, paletteId, fontId,
    ...(photoShape === undefined ? {} : { photoShape }),
    ...(textScale === undefined ? {} : { textScale }),
    ...(width === undefined ? {} : { width }),
    ...(accent === undefined ? {} : { accent }),
    ...(surface === undefined ? {} : { surface }),
    ...(corners === undefined ? {} : { corners }),
    ...(shadow === undefined ? {} : { shadow }),
    ...(density === undefined ? {} : { density }),
    ...(headingStyle === undefined ? {} : { headingStyle }),
    ...(heroAlign === undefined ? {} : { heroAlign }),
    ...(photoSize === undefined ? {} : { photoSize }),
    ...(background === undefined ? {} : { background }),
    ...(value.autoDark === undefined ? {} : { autoDark: value.autoDark }),
    ...(value.hideBranding === undefined ? {} : { hideBranding: value.hideBranding }),
    ...(customPalette === undefined ? {} : { customPalette }),
  };
}

/** Complete runtime decoder shared by persisted drafts and file/share imports. */
export function decodeSiteData(value: unknown): SiteData | null {
  if (!isObject(value) || value.version !== 1 || typeof value.name !== 'string') return null;
  const lang = optionalString(value.lang);
  const tagline = optionalString(value.tagline);
  const footerNote = optionalString(value.footerNote);
  if (lang === null || tagline === null || footerNote === null) return null;
  if (lang !== undefined && !/^[a-z]{2,3}(-[a-zA-Z0-9-]{1,10})?$/.test(lang)) return null;
  const photo = decodeImage(value.photo);
  const favicon = decodeImage(value.favicon);
  const links = decodeLinks(value.links);
  const sections = decodeSections(value.sections);
  const meta = decodeSiteMeta(value.meta);
  if (photo === null || favicon === null || links === null || sections === null || !meta) return null;
  return {
    version: 1,
    name: value.name,
    ...(lang === undefined ? {} : { lang }),
    ...(tagline === undefined ? {} : { tagline }),
    ...(photo === undefined ? {} : { photo }),
    ...(favicon === undefined ? {} : { favicon }),
    links,
    sections,
    ...(footerNote === undefined ? {} : { footerNote }),
    meta,
  };
}

/** Replace a live draft without retaining optional fields absent from an import. */
export function replaceSiteData(target: SiteData, source: SiteData): void {
  for (const key of Object.keys(target) as (keyof SiteData)[]) delete target[key];
  Object.assign(target, structuredClone(source));
}
