import type { ThemePack } from '../../../engine/types.js';

const css = `/* business voice: ruutu — price-board rhythm */
.page { margin: 0 auto; padding: clamp(1.25rem, 4vw, 3rem) 1rem 3rem; }
.hero { position: relative; padding: clamp(1rem, 4vw, 2.75rem) 0; border-block: 3px solid var(--text); }
.hero h1 {
  max-width: 16ch;
  font-size: clamp(2.75rem, 8vw, 6.25rem);
  font-weight: 700;
  letter-spacing: -.045em;
  line-height: .92;
}
.hero-initial {
  display: inline-grid;
  place-items: center;
  min-width: .95em;
  min-height: .95em;
  margin-right: .08em;
  background: var(--accent);
  color: var(--accent-contrast);
  box-shadow: .12em .12em 0 var(--text);
}
.hero-stack .hero-line { display: block; }
.hero .photo { width: 8rem; height: 8rem; margin-bottom: 1.2rem; border: 3px solid var(--text); }
.eyebrow-locality { margin-bottom: .7rem; color: var(--muted); font-size: .78rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
.badge-year { display: inline-block; margin-top: .8rem; color: var(--muted); font-size: .8rem; font-weight: 700; }
.tagline { max-width: 42rem; margin-top: 1rem; font-size: 1.15rem; }
.cta-call { margin-top: 1.2rem; border-radius: 0; }
.hero .links { margin-top: .8rem; }
.section { padding-top: .4rem; }
.section h2 { font-size: .82rem; letter-spacing: .14em; text-transform: uppercase; }
.menu-board {
  display: block;
  padding: clamp(1rem, 3vw, 2rem);
  border: 3px solid var(--text);
  background: var(--surface);
  box-shadow: 7px 7px 0 var(--accent);
}
.service-group { margin-top: 1.75rem; border-bottom: 3px solid var(--text); padding-bottom: .35rem; letter-spacing: .1em; text-transform: uppercase; }
.menu-board .service {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  column-gap: .65rem;
  padding: .65rem 0;
}
.menu-board .service + .service { border-top: 1px solid color-mix(in srgb, var(--muted) 38%, transparent); }
.menu-board .service h3 { display: flex; align-items: baseline; gap: .5rem; min-width: 0; }
.menu-board .service h3::after { content: ""; flex: 1; min-width: 1.5rem; border-bottom: 2px dotted var(--muted); }
.menu-board .service-price { grid-column: 2; grid-row: 1; color: var(--text); font-weight: 700; white-space: nowrap; }
.menu-board .desc { grid-column: 1 / -1; margin-top: .12rem; font-size: .88rem; }
.service-price, .hours-list { font-variant-numeric: tabular-nums; }
.hours-list { border-block: 3px solid var(--text); padding: .55rem 0; }
.hours-row { grid-template-columns: minmax(8rem, 1fr) auto; padding: .28rem .5rem; }
.hours-row:nth-child(odd) { background: color-mix(in srgb, var(--accent) 9%, transparent); }
.section-location { display: grid; grid-template-columns: minmax(10rem, .65fr) 1fr; gap: 1rem; border-top: 3px solid var(--text); padding-top: 1rem; }
footer { border-top: 3px solid var(--text); padding-top: .8rem; font-variant-numeric: tabular-nums; }
@media (max-width: 36rem) {
  .menu-board { box-shadow: 4px 4px 0 var(--accent); }
  .section-location { grid-template-columns: 1fr; }
}
`;

export const ruutu: ThemePack = {
  id: 'ruutu',
  name: 'Ruutu',
  tagline: 'Price-board rhythm',
  biz: true,
  layout: 'centered-column',
  photoShape: 'square',
  pageMax: '64rem',
  fonts: [{ id: 'system', name: 'Board sans', stack: '"Trebuchet MS", "DejaVu Sans", Verdana, sans-serif' }],
  palettes: [
    { id: 'valko', name: 'Valko', vars: { bg: '#fafaf7', surface: '#fafaf7', text: '#111827', muted: '#535b68', accent: '#b91c1c', 'accent-contrast': '#ffffff' } },
    { id: 'kelta', name: 'Kelta', vars: { bg: '#fdf6e3', surface: '#fdf6e3', text: '#1f2937', muted: '#59606a', accent: '#9a5805', 'accent-contrast': '#ffffff' } },
    { id: 'vihrea', name: 'Vihreä', vars: { bg: '#f1f8f4', surface: '#f1f8f4', text: '#122117', muted: '#506057', accent: '#117437', 'accent-contrast': '#ffffff' } },
    { id: 'harmaa', name: 'Harmaa', vars: { bg: '#f4f4f5', surface: '#f4f4f5', text: '#18181b', muted: '#55555b', accent: '#0e7490', 'accent-contrast': '#ffffff' } },
    { id: 'liitutaulu', name: 'Liitutaulu', vars: { bg: '#1a2e22', surface: '#1a2e22', text: '#f0fdf4', muted: '#b7cbbd', accent: '#facc15', 'accent-contrast': '#1a2e22' } },
    { id: 'rusko', name: 'Rusko', vars: { bg: '#f8f4ef', surface: '#f8f4ef', text: '#292018', muted: '#62584e', accent: '#7c2d12', 'accent-contrast': '#ffffff' } },
  ],
  css,
  defaults: { paletteId: 'valko', fontId: 'system' },
};
