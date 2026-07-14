import type { SiteData } from '../engine/types.js';
import { THEMES } from '../themes/index.js';
import { decodeSiteData } from './site-data.js';

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

export function decodeAppState(raw: unknown): AppState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const parsed = raw as { step?: unknown; data?: unknown };
  const data = decodeSiteData(parsed.data);
  if (!data) return null;
  const step = typeof parsed.step === 'number' && [1, 2, 3, 4].includes(parsed.step)
    ? parsed.step as AppState['step']
    : 1;
  return { step, data };
}

function pageId(): string {
  return crypto.randomUUID();
}

function freshStore(): PagesStore {
  const id = pageId();
  return { activeId: id, pages: [{ id, state: { step: 1, data: freshData() } }] };
}

function decodeStore(raw: unknown): { store: PagesStore; changed: boolean } | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const parsed = raw as { activeId?: unknown; pages?: unknown };
  if (!Array.isArray(parsed.pages)) return null;
  const pages: PageRecord[] = [];
  const seen = new Set<string>();
  let changed = false;
  for (const record of parsed.pages) {
    if (typeof record !== 'object' || record === null) {
      changed = true;
      continue;
    }
    const candidate = record as { id?: unknown; state?: unknown };
    const state = decodeAppState(candidate.state);
    if (!state) {
      changed = true;
      continue;
    }
    const hasId = typeof candidate.id === 'string' && candidate.id.length > 0;
    let id = hasId ? candidate.id as string : pageId();
    if (!hasId) changed = true;
    if (seen.has(id)) {
      id = pageId();
      changed = true;
    }
    seen.add(id);
    pages.push({ id, state });
  }
  if (!pages.length) return null;
  const requestedActive = typeof parsed.activeId === 'string' ? parsed.activeId : '';
  const activeId = pages.some((page) => page.id === requestedActive) ? requestedActive : pages[0]!.id;
  if (activeId !== parsed.activeId) changed = true;
  return { store: { activeId, pages }, changed };
}

function readStore(): PagesStore {
  try {
    const raw = localStorage.getItem(PAGES_KEY);
    if (raw) {
      const decoded = decodeStore(JSON.parse(raw));
      if (decoded) {
        if (decoded.changed) writeStore(decoded.store);
        return decoded.store;
      }
    }
    // migrate the single-draft era
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const state = decodeAppState(JSON.parse(legacy));
      if (state) {
        const id = pageId();
        const store: PagesStore = { activeId: id, pages: [{ id, state }] };
        if (writeStore(store)) localStorage.removeItem(LEGACY_KEY);
        return store;
      }
    }
  } catch {
    // corrupt: start over rather than dead-end
  }
  return freshStore();
}

function writeStore(store: PagesStore): boolean {
  try {
    localStorage.setItem(PAGES_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export function loadState(): AppState {
  const store = readStore();
  const active = store.pages.find((p) => p.id === store.activeId) ?? store.pages[0]!;
  return decodeAppState(active.state) ?? { step: 1, data: freshData() };
}

export function saveState(state: AppState): boolean {
  const store = readStore();
  const active = store.pages.find((p) => p.id === store.activeId) ?? store.pages[0]!;
  active.state = state;
  return writeStore(store);
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
  const id = pageId();
  store.pages.push({ id, state: { step: 1, data: freshData() } });
  store.activeId = id;
  writeStore(store);
}

export function deletePage(id: string): void {
  const store = readStore();
  store.pages = store.pages.filter((p) => p.id !== id);
  if (!store.pages.length) store.pages = [{ id: pageId(), state: { step: 1, data: freshData() } }];
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
