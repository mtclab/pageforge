export type BusinessLocale = 'fi' | 'en' | 'sv';

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
}

/** Shared headings and labels for deterministic business-site rendering. */
export const BUSINESS_LABELS: Record<'fi' | 'en' | 'sv', BusinessLabels> = {
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
  },
};

/** Unknown and missing languages retain the existing English fallback. */
export function businessLabels(lang?: string): BusinessLabels {
  const normalized = lang?.toLowerCase();
  if (normalized === 'fi' || normalized?.startsWith('fi-')) return BUSINESS_LABELS.fi;
  if (normalized === 'sv' || normalized?.startsWith('sv-')) return BUSINESS_LABELS.sv;
  return BUSINESS_LABELS.en;
}
