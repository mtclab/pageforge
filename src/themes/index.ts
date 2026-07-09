import type { ThemePack } from '../engine/types.js';
import { atelier } from './atelier/theme.js';
import { aurora } from './aurora/theme.js';
import { gazette } from './gazette/theme.js';
import { ink } from './ink/theme.js';
import { linen } from './linen/theme.js';
import { meadow } from './meadow/theme.js';
import { nordic } from './nordic/theme.js';
import { slate } from './slate/theme.js';
import { studio } from './studio/theme.js';
import { terminal } from './terminal/theme.js';
import { zine } from './zine/theme.js';

export const THEMES: ThemePack[] = [
  slate,
  nordic,
  linen,
  meadow,
  gazette,
  ink,
  atelier,
  studio,
  aurora,
  zine,
  terminal,
];

export function getTheme(id: string): ThemePack {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!;
}
