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
  | { kind: 'custom'; title: string; text: string };

export interface SiteData {
  version: 1;
  name: string;
  tagline?: string;
  /** Cropped square JPEG data URL, max 512x512. Produced by the wizard. */
  photo?: { dataUrl: string };
  links: Link[];
  sections: Section[];
  footerNote?: string;
  meta: { themeId: string; paletteId: string; fontId: string };
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
  defaults: { paletteId: string; fontId: string };
}

export interface RenderedSite {
  html: string;
  css: string;
}

/** Path the generated HTML uses for the photo; the zip and the preview both key off this. */
export const PHOTO_PATH = 'assets/photo.jpg';
export const FAVICON_PATH = 'assets/favicon.svg';
