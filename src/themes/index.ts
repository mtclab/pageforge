import type { ThemePack } from '../engine/types.js';
import { atelier } from './atelier/theme.js';
import { ink } from './ink/theme.js';
import { linen } from './linen/theme.js';
import { slate } from './slate/theme.js';
import { terminal } from './terminal/theme.js';

export const THEMES: ThemePack[] = [slate, linen, ink, atelier, terminal];

export function getTheme(id: string): ThemePack {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!;
}
