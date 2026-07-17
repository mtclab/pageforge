import type { ThemePack } from '../../../engine/types.js';

const css = `/* business voice: pehmo — warm craft */
.page { margin: 0 auto; padding: clamp(1.25rem, 4vw, 3.5rem) 1rem 4rem; }
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem 2rem;
  padding: clamp(1.5rem, 4vw, 3rem);
  border-radius: 28px 14px 28px 14px;
  background: var(--surface);
  box-shadow: 0 16px 38px color-mix(in srgb, var(--text) 12%, transparent);
}
.hero .photo { grid-column: 2; grid-row: 1 / span 4; width: clamp(8rem, 22vw, 15rem); aspect-ratio: 4 / 5; filter: sepia(.5) saturate(1.3) hue-rotate(-9deg); }
.hero h1 { font-size: clamp(2.6rem, 7vw, 5.2rem); font-weight: 700; line-height: 1.02; }
.hero-stack .hero-line { display: block; }
.hero-initial { display: inline; }
.eyebrow-locality { color: var(--accent); font-size: .78rem; font-weight: 700; letter-spacing: .08em; }
.badge-year { color: var(--muted); font-size: .78rem; }
.tagline { max-width: 34rem; font-size: 1.12rem; line-height: 1.65; }
.cta-call { justify-self: start; border-radius: 999px; }
.hero .links { grid-column: 1 / -1; margin-top: .4rem; }
.section {
  position: relative;
  padding: clamp(1.2rem, 3vw, 2rem);
  border: 1px solid color-mix(in srgb, var(--accent) 24%, transparent);
  border-radius: 14px;
  background: var(--surface);
}
.section h2 { color: var(--accent); font-size: 1.35rem; }
.services { grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 1.25rem; }
.service { padding: .9rem; border-radius: 14px; background: color-mix(in srgb, var(--accent) 7%, var(--surface)); }
.service-price { margin-top: .55rem; }
.section-hours {
  margin: calc(3rem * var(--density)) .5rem 0;
  transform: rotate(-1.2deg);
  border: 2px dashed var(--accent);
  box-shadow: 0 12px 24px color-mix(in srgb, var(--text) 14%, transparent);
}
.section-hours::before {
  content: "";
  position: absolute;
  z-index: 1;
  top: -.72rem;
  left: 50%;
  width: 7.5rem;
  height: 1.35rem;
  transform: translateX(-50%) rotate(.7deg);
  background: color-mix(in srgb, var(--accent) 30%, var(--bg));
  box-shadow: 0 1px 2px color-mix(in srgb, var(--text) 20%, transparent);
}
.hours-list { gap: .5rem; }
.gallery img { border-radius: 14px; filter: sepia(.5) saturate(1.3) hue-rotate(-9deg); }
.section-location { border-radius: 28px 14px 28px 14px; }
footer { text-align: center; }
@media (max-width: 42rem) {
  .hero { display: block; }
  .hero .photo { width: 100%; max-height: 15rem; margin-bottom: 1.25rem; }
  .hero > * + * { margin-top: .8rem; }
  .services { grid-template-columns: 1fr; }
}
`;

export const pehmo: ThemePack = {
  id: 'pehmo',
  name: 'Pehmo',
  tagline: 'Warm craft',
  biz: true,
  layout: 'card-stack',
  photoShape: 'rounded',
  pageMax: '66rem',
  fonts: [{ id: 'system', name: 'Rounded humanist', stack: '"Trebuchet MS", "Segoe UI Rounded", Comfortaa, system-ui, sans-serif' }],
  palettes: [
    { id: 'kerma', name: 'Kerma', vars: { bg: '#f8f1e7', surface: '#fffaf3', text: '#2d2418', muted: '#665b4e', accent: '#984a33', 'accent-contrast': '#ffffff' } },
    { id: 'sammal', name: 'Sammal', vars: { bg: '#f4f0e4', surface: '#fcf8ee', text: '#29251b', muted: '#635e52', accent: '#52672b', 'accent-contrast': '#ffffff' } },
    { id: 'luumu', name: 'Luumu', vars: { bg: '#f7eee9', surface: '#fff8f4', text: '#302129', muted: '#6c5b63', accent: '#75405e', 'accent-contrast': '#ffffff' } },
    { id: 'hunaja', name: 'Hunaja', vars: { bg: '#faf1dc', surface: '#fff9eb', text: '#302616', muted: '#6c604b', accent: '#865600', 'accent-contrast': '#ffffff' } },
    { id: 'laguuni', name: 'Laguuni', vars: { bg: '#eef3eb', surface: '#f8fbf5', text: '#1e2b26', muted: '#58655f', accent: '#176964', 'accent-contrast': '#ffffff' } },
    { id: 'kaakao', name: 'Kaakao', vars: { bg: '#241a17', surface: '#30231f', text: '#f5ede4', muted: '#c1b2a8', accent: '#ee9871', 'accent-contrast': '#241a17' } },
  ],
  css,
  defaults: { paletteId: 'kerma', fontId: 'system' },
};
