import type { SiteData } from '../engine/types.js';
import { THEMES } from '../themes/index.js';

const LEGACY_KEY = 'pageforge-draft-v1';
const PAGES_KEY = 'pageforge-pages-v1';

export interface AppState {
  step: 1 | 2 | 3 | 4;
  data: SiteData;
}

interface PageRecord {
  id: string;
  state: AppState;
}

interface PagesStore {
  activeId: string;
  pages: PageRecord[];
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

function validState(raw: unknown): AppState | null {
  const parsed = raw as { step?: number; data?: SiteData };
  if (parsed?.data?.version === 1 && typeof parsed.data.name === 'string') {
    const step = [1, 2, 3, 4].includes(parsed.step ?? 0) ? (parsed.step as AppState['step']) : 1;
    return { step, data: { ...freshData(), ...parsed.data } };
  }
  return null;
}

function readStore(): PagesStore {
  try {
    const raw = localStorage.getItem(PAGES_KEY);
    if (raw) {
      const store = JSON.parse(raw) as PagesStore;
      if (Array.isArray(store.pages) && store.pages.length) return store;
    }
    // migrate the single-draft era
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const state = validState(JSON.parse(legacy));
      if (state) {
        const store: PagesStore = { activeId: 'p1', pages: [{ id: 'p1', state }] };
        localStorage.setItem(PAGES_KEY, JSON.stringify(store));
        localStorage.removeItem(LEGACY_KEY);
        return store;
      }
    }
  } catch {
    // corrupt: start over rather than dead-end
  }
  return { activeId: 'p1', pages: [{ id: 'p1', state: { step: 1, data: freshData() } }] };
}

function writeStore(store: PagesStore): void {
  try {
    localStorage.setItem(PAGES_KEY, JSON.stringify(store));
  } catch {
    // storage full or blocked: the app still works, drafts just do not persist
  }
}

export function loadState(): AppState {
  const store = readStore();
  const active = store.pages.find((p) => p.id === store.activeId) ?? store.pages[0]!;
  return validState(active.state) ?? { step: 1, data: freshData() };
}

export function saveState(state: AppState): void {
  const store = readStore();
  const active = store.pages.find((p) => p.id === store.activeId) ?? store.pages[0]!;
  active.state = state;
  writeStore(store);
}

/** [id, display name, active] for the my-pages switcher. */
export function listPages(): [string, string, boolean][] {
  const store = readStore();
  return store.pages.map((p) => [p.id, p.state.data.name.trim() || 'Untitled page', p.id === store.activeId]);
}

export function switchPage(id: string): void {
  const store = readStore();
  if (store.pages.some((p) => p.id === id)) {
    store.activeId = id;
    writeStore(store);
  }
}

export function newPage(): void {
  const store = readStore();
  const id = `p${store.pages.length + 1}-${store.pages.map((p) => p.id).join('').length}`;
  store.pages.push({ id, state: { step: 1, data: freshData() } });
  store.activeId = id;
  writeStore(store);
}

export function deletePage(id: string): void {
  const store = readStore();
  store.pages = store.pages.filter((p) => p.id !== id);
  if (!store.pages.length) store.pages = [{ id: 'p1', state: { step: 1, data: freshData() } }];
  if (!store.pages.some((p) => p.id === store.activeId)) store.activeId = store.pages[0]!.id;
  writeStore(store);
}

export function clearDraft(): void {
  const store = readStore();
  const active = store.pages.find((p) => p.id === store.activeId);
  if (active) {
    active.state = { step: 1, data: freshData() };
    writeStore(store);
  }
}
