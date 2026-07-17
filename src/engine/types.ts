export type LinkKind =
  | 'email'
  | 'github'
  | 'instagram'
  | 'linkedin'
  | 'youtube'
  | 'facebook'
  | 'x'
  | 'phone'
  | 'website';

export interface Link {
  label: string;
  url: string;
  /** Auto-detected from the URL when absent. */
  kind?: LinkKind;
}

/**
 * A photo reference. The personal-site app always produces an inline
 * `{ dataUrl }` (bundled into the zip / served from KV). The mikoshi business
 * control plane instead stores photos in R2 and references them by
 * `{ src: "/img/<sha256>" }`; the renderer emits either verbatim (escaped).
 */
export type PhotoRef = { dataUrl: string } | { src: string };

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
  | { kind: 'gallery'; title?: string; photos: PhotoRef[] }
  | {
      kind: 'hours';
      title?: string;
      days: { label: string; open?: string; close?: string; closed?: boolean }[];
      exceptions?: { date: string; text: string }[];
    }
  | {
      kind: 'services';
      title?: string;
      items: { name: string; desc?: string; price?: string }[];
    }
  | { kind: 'notice'; title?: string; text: string; until?: string }
  | { kind: 'location'; title?: string; address?: string; phone?: string; mapUrl?: string };

export interface SiteData {
  version: 1;
  name: string;
  /** BCP47 language of the page content (html lang). Defaults to "en". */
  lang?: string;
  tagline?: string;
  /** Cropped square JPEG data URL, max 512x512. Produced by the wizard. */
  photo?: PhotoRef;
  /** Custom tab icon: 64x64 PNG data URL. Absent = generated initials icon. */
  favicon?: { dataUrl: string };
  links: Link[];
  sections: Section[];
  business?: { phone?: string; address?: string; yTunnus?: string };
  capabilities?: {
    hours?: boolean;
    services?: boolean;
    gallery?: boolean;
    notice?: boolean;
    location?: boolean;
    contact?: boolean;
  };
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
    /** Paid business sites may suppress the Mikoshi footer credit. */
    hideBranding?: boolean;
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

/** Path the generated HTML uses for the photo; the zip and the preview both key off this. */
export const PHOTO_PATH = 'assets/photo.jpg';
export const FAVICON_PATH = 'assets/favicon.svg';
export const CUSTOM_FAVICON_PATH = 'assets/favicon.png';

/** Stable asset path for gallery photo j of section i (1-based section index). */
export function galleryPath(sectionIdx: number, photoIdx: number): string {
  return `assets/gallery-${sectionIdx}-${photoIdx + 1}.jpg`;
}

/**
 * Every INLINE image the site references: [zip path, data URL]. Only
 * `{ dataUrl }` photos are bundled; `{ src: "/img/..." }` R2 references are
 * skipped here on purpose (they are served from R2, not embedded).
 * TODO(S10 export): the authenticated export ZIP must resolve and inline R2
 * `src` photos too - see docs/MIKOSHI_BUILD_PLAN.md slice S10.
 */
export function collectImages(data: SiteData): [string, string][] {
  const images: [string, string][] = [];
  if (data.photo && 'dataUrl' in data.photo) images.push([PHOTO_PATH, data.photo.dataUrl]);
  if (data.favicon) images.push([CUSTOM_FAVICON_PATH, data.favicon.dataUrl]);
  data.sections.forEach((section, i) => {
    if (section.kind !== 'gallery') return;
    section.photos.forEach((photo, j) => {
      if ('dataUrl' in photo) images.push([galleryPath(i + 1, j), photo.dataUrl]);
    });
  });
  return images;
}
