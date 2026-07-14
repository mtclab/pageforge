import { describe, expect, it } from 'vitest';
import { wrapOgName } from '../src/app/og.js';

describe('OG name wrapping', () => {
  it('wraps to two lines and truncates at grapheme boundaries', () => {
    const family = '👩‍👩‍👧‍👦';
    const lines = wrapOgName(`Long ${family} family name that keeps going`, (text) => [...text].length, 8);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatch(/…$/);
    const shown = lines.join('');
    expect(shown).toContain(family);
  });
});
