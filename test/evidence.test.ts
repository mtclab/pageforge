import { describe, expect, it } from 'vitest';
import { extractFoundingYear } from '../src/engine/evidence.js';

describe('business evidence', () => {
  it('extracts supported founding-year phrases case-insensitively', () => {
    expect(extractFoundingYear('Palvelemme Kuopiossa vuodesta 1987.')).toBe('1987');
    expect(extractFoundingYear('EST. 2004')).toBe('2004');
    expect(extractFoundingYear('Yritys on perustettu 1996.')).toBe('1996');
  });

  it('rejects absent, unrelated, and implausible years', () => {
    expect(extractFoundingYear()).toBeNull();
    expect(extractFoundingYear('Puhelin 040 123 4567')).toBeNull();
    expect(extractFoundingYear('Vuodesta 1799')).toBeNull();
    expect(extractFoundingYear('Perustettu 2101')).toBeNull();
  });
});
