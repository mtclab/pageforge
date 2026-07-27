export type LinkKind =
  | 'email'
  | 'github'
  | 'instagram'
  | 'linkedin'
  | 'youtube'
  | 'facebook'
  | 'x'
  | 'website';

export interface Link {
  label: string;
  url: string;
  /** Auto-detected from the URL when absent. */
  kind?: LinkKind;
}

export type Section =
  | { kind: 'about'; text: string }
  | {
      kind: 'projects';
      title?: string;
      items: { name: string; desc?: string; url?: string }[];
    }
  | { kind: 'hobbies'; title?: string; items: string[] }
  | { kind: 'contact'; email?: string; note?: string }
  | { kind: 'custom'; title: string; text: string }
  /**
   * `alt` is the author's description of the picture, used as the image's alt
   * text. Absent or blank means "decorative": the image renders with alt="".
   */
  | { kind: 'gallery'; title?: string; photos: { dataUrl: string; alt?: string }[] };

export interface SiteData {
  version: 1;
  name: string;
  /** BCP47 language of the page content (html lang). Defaults to "en". */
  lang?: string;
  tagline?: string;
  /** Cropped square JPEG data URL, max 512x512. Produced by the wizard. */
  photo?: { dataUrl: string };
  /** Custom tab icon: 64x64 PNG data URL. Absent = generated initials icon. */
  favicon?: { dataUrl: string };
  links: Link[];
  sections: Section[];
  footerNote?: string;
  meta: {
    themeId: string;
    paletteId: string;
    fontId: string;
    /** Style overrides on top of the theme; all optional and theme-safe. */
    photoShape?: PhotoShape;
    textScale?: 's' | 'm' | 'l';
    width?: 'narrow' | 'normal' | 'wide';
    /** Custom accent (#rrggbb); auto-adjusted to keep WCAG AA on the palette bg. */
    accent?: string;
    /** Section presentation; absent = the theme's own styling. */
    surface?: 'card' | 'flat' | 'bordered' | 'tinted';
    corners?: 'sharp' | 'soft' | 'round';
    shadow?: 'none' | 'soft' | 'lifted';
    density?: 'compact' | 'normal' | 'airy';
    /** Heading treatment on top of the theme; absent = theme's own. */
    headingStyle?: 'underline' | 'highlight' | 'caps';
    /** Hero alignment override; absent = theme's own. */
    heroAlign?: 'left' | 'center';
    /** Photo size override; absent = theme's own. */
    photoSize?: 's' | 'l';
    /** One background treatment; absent = theme's own background. */
    background?: 'dots' | 'grid' | 'lines' | 'wash-top' | 'wash-corner';
    /** Follow the visitor's dark mode using the theme's darkest palette. */
    autoDark?: boolean;
    /**
     * Fully custom colors (theme designer). Every pair is contrast-guarded
     * at render time, so an unreadable page cannot be produced.
     */
    customPalette?: { bg: string; surface: string; text: string; muted: string; accent: string };
  };
}

export type Layout = 'centered-column' | 'split-hero' | 'banner' | 'card-stack';
export type PhotoShape = 'circle' | 'rounded' | 'square';

export interface Font {
  id: string;
  /** Friendly name shown in the wizard. */
  name: string;
  /** CSS font-family stack for body text. System fonts only in v1. */
  stack: string;
  /** Optional distinct stack for headings; falls back to `stack`. */
  headingStack?: string;
}

export interface Palette {
  id: string;
  name: string;
  vars: {
    bg: string;
    surface: string;
    text: string;
    muted: string;
    accent: string;
    'accent-contrast': string;
  };
}

export interface ThemePack {
  id: string;
  name: string;
  tagline: string;
  layout: Layout;
  photoShape: PhotoShape;
  fonts: Font[];
  palettes: Palette[];
  /** Theme-specific structural CSS, appended after the base CSS. */
  css: string;
  /**
   * The theme's natural content width, e.g. "42rem". Feeds --page-max;
   * the user's width choice scales it (narrow x0.85, wide x1.25). Themes
   * must NOT hardcode .page max-width in css (lint-tested).
   */
  pageMax: string;
  defaults: { paletteId: string; fontId: string };
}

export interface RenderedSite {
  html: string;
  css: string;
}

/** The languages our generated headings and labels actually exist in. */
export type LabelLocale = 'fi' | 'en' | 'sv';

/**
 * Headings for a page about ONE person. Every page this tool makes is one
 * person's page, so there is a single voice: the labels say "about me", never
 * "about us". The English strings are also the fallback for any language we
 * have no labels for.
 */
export interface PersonalLabels {
  about: string;
  projects: string;
  hobbies: string;
  contact: string;
  gallery: string;
  /** Label on the obfuscated mail link. */
  email: string;
}

export const PERSONAL_LABELS: Record<LabelLocale, PersonalLabels> = {
  fi: {
    about: 'Tietoa minusta',
    projects: 'Mitä teen',
    hobbies: 'Mistä pidän',
    contact: 'Ota yhteyttä',
    gallery: 'Kuvat',
    email: 'Lähetä sähköpostia',
  },
  en: {
    about: 'About',
    projects: 'Things I make',
    hobbies: 'Things I love',
    contact: 'Get in touch',
    gallery: 'Photos',
    email: 'Email me',
  },
  sv: {
    about: 'Om mig',
    projects: 'Vad jag gör',
    hobbies: 'Vad jag gillar',
    contact: 'Kontakt',
    gallery: 'Bilder',
    email: 'Mejla mig',
  },
};

/** The locale our labels come out in: fi and sv when asked for, else English. */
export function labelLocale(lang?: string): LabelLocale {
  const normalized = lang?.toLowerCase();
  if (normalized === 'fi' || normalized?.startsWith('fi-')) return 'fi';
  if (normalized === 'sv' || normalized?.startsWith('sv-')) return 'sv';
  return 'en';
}

/** Unknown and missing languages retain the existing English fallback. */
export function personalLabels(lang?: string): PersonalLabels {
  return PERSONAL_LABELS[labelLocale(lang)];
}

export interface LabelContext {
  personal: PersonalLabels;
  /**
   * ` lang="en"` when the page is in a language we have no labels for. The
   * document keeps the author's own `html lang` - their words really are in
   * that language - and the English words WE generate are marked as English,
   * so nothing on the page claims to be a language it is not. Empty when the
   * labels are already in the page's own language.
   */
  labelLangAttr: string;
}

export function labelContext(data: SiteData): LabelContext {
  const locale = labelLocale(data.lang);
  const pageBase = (data.lang ?? 'en').toLowerCase().split('-')[0];
  return {
    personal: PERSONAL_LABELS[locale],
    labelLangAttr: pageBase === locale ? '' : ' lang="en"',
  };
}

/**
 * The folder inside the downloaded zip that holds the website itself.
 * Everything under it is meant to be uploaded; everything beside it must never
 * be, because the draft (site.json) carries the author's email address in
 * plain text while the published page carries it only obfuscated.
 */
export const SITE_DIR = 'website';

/** Path the generated HTML uses for the photo; the zip and the preview both key off this. */
export const PHOTO_PATH = 'assets/photo.jpg';
export const FAVICON_PATH = 'assets/favicon.svg';
export const CUSTOM_FAVICON_PATH = 'assets/favicon.png';

/** Stable asset path for gallery photo j of section i (1-based section index). */
export function galleryPath(sectionIdx: number, photoIdx: number): string {
  return `assets/gallery-${sectionIdx}-${photoIdx + 1}.jpg`;
}

/** Every embedded image the site references: [zip path, data URL]. */
export function collectImages(data: SiteData): [string, string][] {
  const images: [string, string][] = [];
  if (data.photo) images.push([PHOTO_PATH, data.photo.dataUrl]);
  if (data.favicon) images.push([CUSTOM_FAVICON_PATH, data.favicon.dataUrl]);
  data.sections.forEach((section, i) => {
    if (section.kind !== 'gallery') return;
    section.photos.forEach((photo, j) => {
      images.push([galleryPath(i + 1, j), photo.dataUrl]);
    });
  });
  return images;
}
