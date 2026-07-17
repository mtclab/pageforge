import type { ThemePack } from '../../../engine/types.js';

const css = `/* business voice: kyltti — sign-painter */
.page { margin: 0 auto; padding: clamp(1rem, 3vw, 2.5rem) 1rem 3rem; }
.hero {
  position: relative;
  border: 6px double var(--text);
  background: var(--surface);
  padding: clamp(1.25rem, 4vw, 3rem);
  box-shadow: 10px 10px 0 var(--accent);
}
.eyebrow-locality {
  margin-bottom: .45rem;
  color: var(--accent);
  font-size: .78rem;
  font-weight: 900;
  letter-spacing: .22em;
  text-transform: uppercase;
}
.hero h1 {
  font-family: "Arial Narrow", "Helvetica Neue Condensed", "Liberation Sans Narrow", sans-serif-condensed, sans-serif;
  font-size: clamp(3rem, 9vw, 6.5rem);
  font-stretch: condensed;
  font-weight: 900;
  letter-spacing: .02em;
  line-height: .86;
  text-transform: uppercase;
}
.hero-stack .hero-line { display: block; }
.hero-initial { display: inline; }
.hero .photo {
  width: min(16rem, 42vw);
  aspect-ratio: 4 / 3;
  margin: 0 0 1.25rem auto;
  border: 5px solid var(--text);
  box-shadow: -8px 8px 0 var(--accent);
}
.badge-year {
  position: absolute;
  right: 1rem;
  bottom: .65rem;
  background: var(--text);
  color: var(--bg);
  padding: .18rem .55rem;
  font-family: system-ui, sans-serif;
  font-size: .7rem;
  font-weight: 800;
  letter-spacing: .1em;
  text-transform: uppercase;
}
.tagline { max-width: 38rem; margin-top: 1.1rem; font-weight: 700; color: var(--text); }
.cta-call { margin-top: 1.25rem; border: 3px solid var(--text); border-radius: 0; box-shadow: 4px 4px 0 var(--text); text-transform: uppercase; }
.hero .links { margin-top: 1rem; }
.section { border-top: 8px solid var(--text); padding-top: 1rem; }
.section h2 {
  color: var(--accent);
  font-family: "Arial Narrow", "Helvetica Neue Condensed", "Liberation Sans Narrow", sans-serif-condensed, sans-serif;
  font-size: 1.15rem;
  font-weight: 900;
  letter-spacing: .09em;
  text-transform: uppercase;
}
.services { grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 0; border: 3px solid var(--text); }
.service { padding: 1rem; border: 1px solid var(--text); }
.service-price { margin-top: .45rem; font-size: 1.1rem; }
.hours-list { border: 3px solid var(--text); padding: .8rem 1rem; }
.hours-row + .hours-row { border-top: 2px solid var(--text); padding-top: .35rem; }
.section-location { background: var(--accent); color: var(--accent-contrast); padding: 1rem; }
.section-location h2, .section-location a { color: var(--accent-contrast); }
footer { border-top: 8px solid var(--text); padding-top: 1rem; text-transform: uppercase; letter-spacing: .06em; }
@media (max-width: 36rem) {
  .hero { box-shadow: 6px 6px 0 var(--accent); }
  .badge-year { position: static; display: inline-block; margin-top: 1rem; }
  .services { grid-template-columns: 1fr; }
}
`;

export const kyltti: ThemePack = {
  id: 'kyltti',
  name: 'Kyltti',
  tagline: 'Sign-painter confidence',
  biz: true,
  layout: 'banner',
  photoShape: 'square',
  pageMax: '72rem',
  fonts: [{
    id: 'system',
    name: 'Condensed sign',
    stack: 'system-ui, "Segoe UI", sans-serif',
    headingStack: '"Arial Narrow", "Helvetica Neue Condensed", "Liberation Sans Narrow", sans-serif-condensed, sans-serif',
  }],
  palettes: [
    { id: 'vaalea', name: 'Vaalea', vars: { bg: '#f7f3e8', surface: '#f7f3e8', text: '#1b1b18', muted: '#55544d', accent: '#b3261e', 'accent-contrast': '#ffffff' } },
    { id: 'sini', name: 'Sini', vars: { bg: '#f7f3e8', surface: '#f7f3e8', text: '#1b1b18', muted: '#55544d', accent: '#1d4ed8', 'accent-contrast': '#ffffff' } },
    { id: 'metsa', name: 'Metsä', vars: { bg: '#f2f1e5', surface: '#f2f1e5', text: '#141712', muted: '#50554b', accent: '#166534', 'accent-contrast': '#ffffff' } },
    { id: 'savi', name: 'Savi', vars: { bg: '#f6efe4', surface: '#f6efe4', text: '#231a12', muted: '#5b5147', accent: '#9a3412', 'accent-contrast': '#ffffff' } },
    { id: 'yoku', name: 'Yökuu', vars: { bg: '#16181d', surface: '#16181d', text: '#f2f2ec', muted: '#b9bbc0', accent: '#fbbf24', 'accent-contrast': '#16181d' } },
    { id: 'petrooli', name: 'Petrooli', vars: { bg: '#f4f6f4', surface: '#f4f6f4', text: '#0f1c1c', muted: '#4d5b5a', accent: '#0f766e', 'accent-contrast': '#ffffff' } },
  ],
  css,
  defaults: { paletteId: 'vaalea', fontId: 'system' },
};
