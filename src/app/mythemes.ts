import type { SiteData } from '../engine/types.js';

/**
 * User-made themes, slice 1 (#9): a named bundle of the Style-step choices
 * on top of a base theme. Pure app-level data - the engine only ever sees
 * the resulting meta, so safety and determinism are unchanged.
 */

const KEY = 'pageforge-mythemes-v1';

export interface MyTheme {
  id: string;
  name: string;
  meta: SiteData['meta'];
}

export function loadMyThemes(): MyTheme[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MyTheme[];
      if (Array.isArray(parsed)) return parsed.filter((t) => t && typeof t.name === 'string' && t.meta);
    }
  } catch {
    // corrupt store: start clean
  }
  return [];
}

function persist(themes: MyTheme[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(themes));
  } catch {
    // storage full/blocked - saving silently unavailable
  }
}

export function saveMyTheme(name: string, meta: SiteData['meta']): MyTheme {
  const themes = loadMyThemes();
  const existing = themes.find((t) => t.name === name);
  const record: MyTheme = {
    id: existing?.id ?? `my-${themes.length + 1}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`,
    name,
    meta: structuredClone(meta),
  };
  persist([...themes.filter((t) => t.name !== name), record]);
  return record;
}

export function deleteMyTheme(id: string): void {
  persist(loadMyThemes().filter((t) => t.id !== id));
}

/** Apply a saved look onto the current draft. */
export function applyMyTheme(data: SiteData, theme: MyTheme): void {
  data.meta = structuredClone(theme.meta);
}
