// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deletePage, listPages, loadState, newPage, saveState } from '../src/app/state.js';
import minimal from './fixtures/minimal.json';

const KEY = 'pageforge-pages-v1';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('multi-page state', () => {
  it('create/delete/create does not reuse an id', () => {
    loadState();
    newPage();
    const created = listPages().find((page) => page[2])![0];
    deletePage(created);
    newPage();
    expect(listPages().find((page) => page[2])![0]).not.toBe(created);
  });

  it('migrates duplicate ids on load', () => {
    const state = { step: 1, data: minimal };
    localStorage.setItem(KEY, JSON.stringify({
      activeId: 'same',
      pages: [{ id: 'same', state }, { id: 'same', state }],
    }));
    loadState();
    const ids = listPages().map((page) => page[0]);
    expect(new Set(ids).size).toBe(2);
    const persisted = JSON.parse(localStorage.getItem(KEY)!);
    expect(new Set(persisted.pages.map((page: { id: string }) => page.id)).size).toBe(2);
  });

  it('reports persistence failure', () => {
    const state = loadState();
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    expect(saveState(state)).toBe(false);
  });
});
