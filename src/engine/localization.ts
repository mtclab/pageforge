import type { SiteData } from './types.js';

/** The languages our generated headings and labels actually exist in. */
export type LabelLocale = 'fi' | 'en' | 'sv';
/** @deprecated Kept as the old name of {@link LabelLocale}. */
export type BusinessLocale = LabelLocale;

export interface BusinessLabels {
  about: string;
  hours: string;
  services: string;
  menu: string;
  notice: string;
  location: string;
  contact: string;
  gallery: string;
  closed: string;
  map: string;
  exceptions: string;
  /** Hero badge prefix: "Vuodesta 1998". */
  since: string;
  /** Hero call button when the phone link carries no label of its own. */
  call: string;
}

/** Shared headings and labels for deterministic business-site rendering. */
export const BUSINESS_LABELS: Record<LabelLocale, BusinessLabels> = {
  fi: {
    about: 'Tietoa meistä',
    hours: 'Aukioloajat',
    services: 'Palvelut',
    menu: 'Ruokalista',
    notice: 'Ajankohtaista',
    location: 'Yhteystiedot',
    contact: 'Ota yhteyttä',
    gallery: 'Kuvat',
    closed: 'Suljettu',
    map: 'Kartta',
    exceptions: 'Poikkeusaukiolot',
    since: 'Vuodesta',
    call: 'Soita',
  },
  en: {
    about: 'About',
    hours: 'Hours',
    services: 'Services',
    menu: 'Menu',
    notice: 'Notice',
    location: 'Contact',
    contact: 'Get in touch',
    gallery: 'Photos',
    closed: 'Closed',
    map: 'Map',
    exceptions: 'Exceptions',
    since: 'Since',
    call: 'Call',
  },
  sv: {
    about: 'Om oss',
    hours: 'Öppettider',
    services: 'Tjänster',
    menu: 'Meny',
    notice: 'Aktuellt',
    location: 'Kontakt',
    contact: 'Kontakt',
    gallery: 'Bilder',
    closed: 'Stängt',
    map: 'Karta',
    exceptions: 'Avvikande öppettider',
    since: 'Sedan',
    call: 'Ring',
  },
};

/**
 * Headings for a page about ONE person. The business set says "about us";
 * printing that on an individual's page is simply false, so the two voices are
 * separate label sets instead of one set reused by both paths.
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
export function businessLabels(lang?: string): BusinessLabels {
  return BUSINESS_LABELS[labelLocale(lang)];
}

export function personalLabels(lang?: string): PersonalLabels {
  return PERSONAL_LABELS[labelLocale(lang)];
}

/**
 * A personal draft cannot carry business metadata or a business-only section:
 * the wizard's own decoder rejects both (app/site-data.ts). Their presence is
 * therefore an honest signal that the page speaks for an organisation, and the
 * only other producer of business pages (worker/biz.ts) says so explicitly.
 */
export function isBusinessSite(data: SiteData, bizPath: boolean): boolean {
  if (bizPath) return true;
  if (data.business !== undefined || data.capabilities !== undefined) return true;
  return data.sections.some(
    (section) => section.kind === 'hours' || section.kind === 'services'
      || section.kind === 'location' || section.kind === 'notice',
  );
}

export interface LabelContext {
  business: BusinessLabels;
  personal: PersonalLabels;
  /** True when the page speaks for an organisation rather than one person. */
  isBusiness: boolean;
  /**
   * ` lang="en"` when the page is in a language we have no labels for. The
   * document keeps the author's own `html lang` - their words really are in
   * that language - and the English words WE generate are marked as English,
   * so nothing on the page claims to be a language it is not. Empty when the
   * labels are already in the page's own language.
   */
  labelLangAttr: string;
}

export function labelContext(data: SiteData, bizPath = false): LabelContext {
  const locale = labelLocale(data.lang);
  const pageBase = (data.lang ?? 'en').toLowerCase().split('-')[0];
  return {
    business: BUSINESS_LABELS[locale],
    personal: PERSONAL_LABELS[locale],
    isBusiness: isBusinessSite(data, bizPath),
    labelLangAttr: pageBase === locale ? '' : ' lang="en"',
  };
}
