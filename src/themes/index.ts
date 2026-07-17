import type { ThemePack } from '../engine/types.js';
import { atelier } from './atelier/theme.js';
import { aurora } from './aurora/theme.js';
import { blueprint } from './blueprint/theme.js';
import { gazette } from './gazette/theme.js';
import { ink } from './ink/theme.js';
import { letterpress } from './letterpress/theme.js';
import { linen } from './linen/theme.js';
import { meadow } from './meadow/theme.js';
import { midnight } from './midnight/theme.js';
import { nordic } from './nordic/theme.js';
import { scrapbook } from './scrapbook/theme.js';
import { slate } from './slate/theme.js';
import { studio } from './studio/theme.js';
import { terminal } from './terminal/theme.js';
import { zine } from './zine/theme.js';
import { arkki } from './biz/arkki/theme.js';
import { kyltti } from './biz/kyltti/theme.js';
import { pehmo } from './biz/pehmo/theme.js';
import { ruutu } from './biz/ruutu/theme.js';
import { yo } from './biz/yo/theme.js';

export const THEMES: ThemePack[] = [
  slate,
  nordic,
  linen,
  meadow,
  scrapbook,
  gazette,
  letterpress,
  ink,
  atelier,
  studio,
  blueprint,
  aurora,
  midnight,
  zine,
  terminal,
  kyltti,
  ruutu,
  pehmo,
  yo,
  arkki,
];

/** Look-step filter chips. A theme may appear under several moods. */
export const THEME_CATEGORIES: { id: string; label: string; themeIds: string[] }[] = [
  { id: 'calm', label: 'Calm', themeIds: ['slate', 'nordic', 'letterpress', 'linen'] },
  { id: 'warm', label: 'Warm', themeIds: ['linen', 'meadow', 'scrapbook', 'nordic'] },
  { id: 'bold', label: 'Bold', themeIds: ['ink', 'zine', 'midnight', 'studio'] },
  { id: 'professional', label: 'Professional', themeIds: ['atelier', 'studio', 'gazette', 'blueprint', 'slate'] },
  { id: 'dark', label: 'Dark', themeIds: ['aurora', 'midnight', 'terminal'] },
  { id: 'playful', label: 'Playful', themeIds: ['meadow', 'scrapbook', 'zine', 'terminal'] },
];

export function getTheme(id: string): ThemePack {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!;
}
