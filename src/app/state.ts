import type { SiteData } from '../engine/types.js';
import { THEMES } from '../themes/index.js';

const STORAGE_KEY = 'pageforge-draft-v1';

export interface AppState {
  step: 1 | 2 | 3 | 4;
  data: SiteData;
}

export function freshData(): SiteData {
  const theme = THEMES[0]!;
  return {
    version: 1,
    name: '',
    links: [],
    sections: [],
    meta: {
      themeId: theme.id,
      paletteId: theme.defaults.paletteId,
      fontId: theme.defaults.fontId,
    },
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { step?: number; data?: SiteData };
      if (parsed.data?.version === 1 && typeof parsed.data.name === 'string') {
        const step = [1, 2, 3, 4].includes(parsed.step ?? 0) ? (parsed.step as AppState['step']) : 1;
        return { step, data: { ...freshData(), ...parsed.data } };
      }
    }
  } catch {
    // Corrupt draft: start over rather than dead-end.
  }
  return { step: 1, data: freshData() };
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked: the app still works, drafts just do not persist.
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
