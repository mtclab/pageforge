/** Deterministic color math for the custom-accent override. */

export function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#([0-9a-fA-F]{6})$/);
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const chan = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * chan(rgb[0]) + 0.7152 * chan(rgb[1]) + 0.0722 * chan(rgb[2]);
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

function blend(hex: string, toward: [number, number, number], t: number): string {
  const rgb = hexToRgb(hex)!;
  return rgbToHex([
    rgb[0] + (toward[0] - rgb[0]) * t,
    rgb[1] + (toward[1] - rgb[1]) * t,
    rgb[2] + (toward[2] - rgb[2]) * t,
  ]);
}

/** Fit one canonical color against every background, or reject the combination. */
export function fitAccentFor(accent: string, backgrounds: string[]): string | null {
  const rgb = hexToRgb(accent);
  if (!rgb || !backgrounds.length || backgrounds.some((bg) => !hexToRgb(bg))) return null;
  const canonical = rgbToHex(rgb);
  if (backgrounds.every((bg) => contrast(canonical, bg) >= 4.5)) return canonical;
  const poles: [number, number, number][] = [[0, 0, 0], [255, 255, 255]];
  for (let step = 1; step <= 20; step += 1) {
    for (const pole of poles) {
      const candidate = blend(canonical, pole, step / 20);
      if (backgrounds.every((bg) => contrast(candidate, bg) >= 4.5)) return candidate;
    }
  }
  return null;
}

/**
 * User picked any accent color; make it usable. Nudges the color toward
 * black or white (whichever direction works against the background) in
 * small steps until it reads at WCAG AA (4.5:1). Deterministic.
 */
export function fitAccent(accent: string, bg: string, fallback = '#000000'): string {
  return fitAccentFor(accent, [bg])
    ?? fitAccentFor(fallback, [bg])
    ?? (contrast('#000000', bg) >= contrast('#ffffff', bg) ? '#000000' : '#ffffff');
}

/** Text color that reads on the (fitted) accent: plain white or near-black. */
export function accentContrastFor(accent: string): string {
  return contrast('#ffffff', accent) >= contrast('#111111', accent) ? '#ffffff' : '#111111';
}
