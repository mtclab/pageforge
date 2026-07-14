import { describe, expect, it } from 'vitest';
import { shouldCoalesceHistory } from '../src/app/history.js';

describe('undo history coalescing', () => {
  const previous = { field: 'name', at: 1000 };

  it('coalesces only rapid consecutive edits to the same text control', () => {
    expect(shouldCoalesceHistory(previous, false, 'name', 1500, true)).toBe(true);
    expect(shouldCoalesceHistory(previous, false, 'tagline', 1500, true)).toBe(false);
    expect(shouldCoalesceHistory(previous, false, 'name', 1900, true)).toBe(false);
  });

  it('never coalesces structural changes', () => {
    expect(shouldCoalesceHistory(previous, true, 'name', 1100, true)).toBe(false);
  });
});
