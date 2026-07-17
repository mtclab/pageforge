import type { ThemePack } from '../../../engine/types.js';

const css = `/* business voice: arkki — letterpress paper */
.page { margin: 0 auto; padding: clamp(1.5rem, 5vw, 4rem) 1.25rem 4rem; }
.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(10rem, .42fr); gap: 1rem 3rem; align-items: end; padding-bottom: 2rem; border-bottom: 1px solid #00000022; }
.hero h1 { grid-column: 1; font-size: clamp(3rem, 8vw, 6.4rem); font-weight: 700; letter-spacing: -.045em; line-height: .9; }
.hero-stack .hero-line { display: block; }
.hero-initial { display: inline; }
.hero .photo { grid-column: 2; grid-row: 1 / span 5; width: 100%; aspect-ratio: 3 / 4; border: 1px solid #00000022; filter: grayscale(1) contrast(.94); }
.eyebrow-locality { grid-column: 1; color: var(--muted); font-size: .74rem; font-style: italic; letter-spacing: .08em; }
.badge-year { grid-column: 1; color: var(--muted); font-size: .76rem; font-style: italic; }
.tagline { grid-column: 1; max-width: 34rem; margin-top: .55rem; color: var(--text); font-size: 1.15rem; font-style: italic; }
.cta-call { grid-column: 1; justify-self: start; margin-top: .75rem; border: 1px solid var(--text); border-radius: 0; background: transparent; color: var(--text); }
.hero .links { grid-column: 1; margin-top: .7rem; }
.section { border-top: 1px solid #00000022; padding-top: 1rem; }
.section h2 { color: var(--muted); font-size: .8rem; font-style: italic; font-weight: 400; letter-spacing: .08em; }
.section-about {
  position: relative;
  margin-left: clamp(0rem, 6vw, 5rem);
  padding: clamp(1.4rem, 4vw, 3rem);
  border: 1px solid #00000022;
  background: var(--surface);
  box-shadow: 0 10px 24px color-mix(in srgb, var(--text) 10%, transparent);
}
.section-about::after {
  content: "";
  position: absolute;
  top: -1px;
  right: -1px;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 0 2rem 2rem 0;
  border-color: transparent var(--bg) color-mix(in srgb, var(--text) 16%, var(--surface)) transparent;
  filter: drop-shadow(-1px 1px 0 #00000022);
}
.initial-cap { float: left; margin: .08em .12em 0 0; color: var(--accent); font-size: 4.6em; font-weight: 700; line-height: .72; }
.services { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 2.5rem; }
.service-group { border-bottom: 1px solid #00000022; padding-bottom: .35rem; font-style: italic; }
.service { padding-bottom: 1rem; border-bottom: 1px solid #00000022; }
.service-price { margin-top: .35rem; font-style: italic; }
.hours-list { max-width: 36rem; }
.hours-row { padding: .25rem 0; border-bottom: 1px solid #00000022; font-variant-numeric: oldstyle-nums tabular-nums; }
.gallery { gap: 1rem; }
.gallery img { border: 1px solid #00000022; border-radius: 0; filter: grayscale(1) contrast(.94); }
footer { border-top: 1px solid #00000022; padding-top: 1rem; font-style: italic; }
@media (max-width: 42rem) {
  .hero { grid-template-columns: 1fr; }
  .hero .photo { grid-column: 1; grid-row: auto; max-height: 18rem; }
  .hero h1, .eyebrow-locality, .badge-year, .tagline, .cta-call, .hero .links { grid-column: 1; }
  .section-about { margin-left: 0; }
  .services { grid-template-columns: 1fr; }
}
`;

export const arkki: ThemePack = {
  id: 'arkki',
  name: 'Arkki',
  tagline: 'Letterpress paper',
  biz: true,
  layout: 'split-hero',
  photoShape: 'square',
  pageMax: '68rem',
  fonts: [{ id: 'system', name: 'Letterpress serif', stack: 'Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif' }],
  palettes: [
    { id: 'paperi', name: 'Paperi', vars: { bg: '#f5f1e8', surface: '#fbf8f1', text: '#26221a', muted: '#625d53', accent: '#8b1e1e', 'accent-contrast': '#ffffff' } },
    { id: 'norsunluu', name: 'Norsunluu', vars: { bg: '#f7f4ec', surface: '#fdfbf6', text: '#22261e', muted: '#5d6258', accent: '#3f6212', 'accent-contrast': '#ffffff' } },
    { id: 'siniharmaa', name: 'Siniharmaa', vars: { bg: '#eef0f2', surface: '#f7f8f9', text: '#1d232b', muted: '#585f68', accent: '#1e3a8a', 'accent-contrast': '#ffffff' } },
    { id: 'pergamentti', name: 'Pergamentti', vars: { bg: '#f3ecdd', surface: '#faf5e9', text: '#2a2118', muted: '#655b4e', accent: '#78350f', 'accent-contrast': '#ffffff' } },
    { id: 'tumma', name: 'Tumma', vars: { bg: '#201d18', surface: '#2b2721', text: '#efe9dc', muted: '#bdb4a5', accent: '#e58a17', 'accent-contrast': '#201d18' } },
    { id: 'viini', name: 'Viini', vars: { bg: '#f6f0ee', surface: '#fcf7f5', text: '#2b1b1b', muted: '#665757', accent: '#7f1d1d', 'accent-contrast': '#ffffff' } },
  ],
  css,
  defaults: { paletteId: 'paperi', fontId: 'system' },
};
