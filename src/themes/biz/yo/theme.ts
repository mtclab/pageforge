import type { ThemePack } from '../../../engine/types.js';

const css = `/* business voice: yö — bold dark */
.page { margin: 0 auto; padding: 0 1rem 3rem; }
.hero { padding: clamp(2rem, 7vw, 6rem) 0 2.5rem; }
.hero h1 {
  position: relative;
  left: 50%;
  width: 100vw;
  margin-left: -50vw;
  padding: clamp(.35rem, 2vw, 1.35rem) max(1rem, calc((100vw - var(--page-max)) / 2));
  background: var(--accent);
  color: var(--accent-contrast);
  font-size: clamp(3.5rem, 12vw, 8rem);
  font-weight: 800;
  letter-spacing: -.03em;
  line-height: .82;
}
.hero-stack .hero-line { display: block; }
.hero-initial { display: inline; }
.eyebrow-locality { margin-bottom: .75rem; color: var(--accent); font-size: .78rem; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
.badge-year { display: inline-block; margin-top: 1rem; border: 1px solid var(--muted); padding: .15rem .45rem; color: var(--text); font-size: .75rem; }
.hero .photo { width: 100%; height: clamp(12rem, 32vw, 25rem); margin-bottom: 1.5rem; border: 1px solid var(--accent); filter: grayscale(1) contrast(1.15); }
.tagline { max-width: 48rem; margin-top: 1.25rem; color: var(--text); font-size: clamp(1.15rem, 2.2vw, 1.55rem); }
.cta-call { margin-top: 1.25rem; border-radius: 0; text-transform: uppercase; letter-spacing: .05em; }
.hero .links { margin-top: 1rem; }
.section { padding-top: 1.25rem; border-top: 1px solid var(--muted); }
.section h2 { color: var(--accent); font-size: .78rem; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
.services { grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr)); gap: 1px; background: var(--muted); border: 1px solid var(--muted); }
.service { min-height: 10rem; padding: 1.2rem; background: var(--bg); }
.service h3 { font-size: 1.45rem; }
.service-price { margin-top: 1rem; font-size: 1.25rem; }
.hours-list { max-width: 38rem; font-variant-numeric: tabular-nums; }
.hours-row { padding: .45rem 0; border-bottom: 1px solid var(--muted); }
.section-notice { border: 2px solid var(--accent); border-left-width: .7rem; background: transparent; }
.section-location { background: var(--accent); color: var(--accent-contrast); border: 0; padding: clamp(1.2rem, 3vw, 2rem); }
.section-location h2, .section-location a { color: var(--accent-contrast); }
footer { border-top: 1px solid var(--muted); padding-top: 1rem; }
@media (max-width: 38rem) {
  .hero h1 { font-size: clamp(3.1rem, 17vw, 5rem); }
  .services { grid-template-columns: 1fr; }
}
`;

const base = { bg: '#0d0f12', surface: '#171a1f', text: '#f4f5f7', muted: '#b4bac4' } as const;

export const yo: ThemePack = {
  id: 'yo',
  name: 'Yö',
  tagline: 'Bold dark',
  biz: true,
  layout: 'banner',
  photoShape: 'square',
  pageMax: '76rem',
  fonts: [{ id: 'system', name: 'Heavy grotesk', stack: 'system-ui, "Segoe UI", Arial, sans-serif' }],
  palettes: [
    { id: 'lime', name: 'Lime', vars: { ...base, accent: '#a3e635', 'accent-contrast': '#0d0f12' } },
    { id: 'vermilion', name: 'Vermilion', vars: { ...base, accent: '#ff5a36', 'accent-contrast': '#0d0f12' } },
    { id: 'cyan', name: 'Cyan', vars: { ...base, accent: '#22d3ee', 'accent-contrast': '#0d0f12' } },
    { id: 'magenta', name: 'Magenta', vars: { ...base, accent: '#e879f9', 'accent-contrast': '#0d0f12' } },
    { id: 'amber', name: 'Amber', vars: { ...base, accent: '#fbbf24', 'accent-contrast': '#0d0f12' } },
    { id: 'ice', name: 'Ice', vars: { ...base, accent: '#e2e8f0', 'accent-contrast': '#0d0f12' } },
  ],
  css,
  defaults: { paletteId: 'lime', fontId: 'system' },
};
