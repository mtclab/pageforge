import { describe, expect, it } from 'vitest';
import { localBusinessJsonLd } from '../src/engine/jsonld.js';
import { renderSite } from '../src/engine/render.js';
import type { SiteData } from '../src/engine/types.js';
import { getTheme } from '../src/themes/index.js';
import { intakePage } from '../src/worker/admin-html.js';
import { bizHtml } from '../src/worker/biz.js';
import {
  BUSINESS_PROFILE_LIMITS,
  type BusinessProfile,
  validateBusinessProfile,
} from '../src/worker/business-profile.js';
import { compose } from '../src/worker/composer.js';
import { ControlPlane, type Prospect } from '../src/worker/db.js';
import { emptyBusinessProfile, parseBusinessProfileForm } from '../src/worker/intake-form.js';
import { panelCandidate } from '../src/worker/panel.js';
import { runQaChecks } from '../src/worker/qa.js';
import { validateSiteData } from '../src/worker/validate.js';
import minimal from './fixtures/minimal.json';
import { workerEnv } from './worker-fixture.js';

const prospect: Prospect = {
  id: 1,
  publicId: 'prospect1',
  name: 'Yögrilli',
  status: 'arvioitu',
  vertical: 'grilli',
  createdAt: 1,
  updatedAt: 1,
};

function validProfile(): BusinessProfile {
  return {
    identity: { name: 'Yögrilli', vertical: { code: 'grilli', label: 'Grilli' } },
    contact: {},
    hours: [{ label: 'Ma', open: '22:00', close: '02:00' }],
    exceptions: [{ date: '24.12.', text: 'suljettu' }],
    services: [],
    menu: [],
    photos: [],
    links: [],
    provenance: {},
    consent: {},
  };
}

describe('S13 form mechanics', () => {
  it('renders only filled rows plus two spares and explains empty repeat blocks', () => {
    const html = intakePage({
      prospect,
      profile: emptyBusinessProfile(prospect),
      csrf: 'csrf',
    });
    for (const prefix of ['hours', 'exceptions', 'services', 'menu', 'links']) {
      const section = html.match(new RegExp(`<section data-repeat="${prefix}">([\\s\\S]*?)</section>`))?.[1];
      expect(section).toBeDefined();
      expect(section).not.toContain('Ei rivejä vielä');
      expect(section?.match(/<tr data-repeat-row>/g)).toHaveLength(3); // two rows + inert template
      expect(section).toContain(`name="add_rows" value="${prefix}"`);
    }
    expect(html).toContain('Kuvat lisätään sivustonäkymässä sivuston luonnin jälkeen.');
    expect(html).toContain('<details><summary>Näytä myös Palvelut</summary>');
    expect(html).not.toMatch(/<select[^>]+name="[^"]+_source"/);
    expect(html).toContain('>Automaattinen</option>');
    expect(html.match(/<script src="\/rows\.js"><\/script>/g)).toHaveLength(1);
  });

  it('parses sparse indices through twice each scan cap while retaining parsed-row caps', () => {
    const form = new FormData();
    form.set('name', 'Yögrilli');
    form.set('hours_27_label', 'Su');
    form.set('hours_27_open', '22');
    form.set('hours_27_close', '2');
    form.set('exceptions_19_date', '24.12.');
    form.set('exceptions_19_text', 'suljettu');
    form.set('services_39_name', 'Leikkaus');
    form.set('services_39_group', 'Hiukset');
    form.set('menu_39_name', 'Burgeri');
    form.set('links_39_label', 'Koti');
    form.set('links_39_url', 'https://example.com');
    form.set('photos_11_src', `/img/${'a'.repeat(64)}`);
    const parsed = parseBusinessProfileForm(form, prospect, 123);
    expect(parsed.hours).toEqual([{ label: 'Su', open: '22', close: '2' }]);
    expect(parsed.exceptions).toEqual([{ date: '24.12.', text: 'suljettu' }]);
    expect(parsed.services).toEqual([{ name: 'Leikkaus', group: 'Hiukset' }]);
    expect(parsed.menu).toEqual([{ name: 'Burgeri' }]);
    expect(parsed.links).toHaveLength(1);
    expect(parsed.photos).toHaveLength(1);
    expect(parsed.provenance['services.0.group']).toEqual({ source: 'operator', at: 123 });

    const capped = new FormData();
    capped.set('name', 'Yögrilli');
    for (let index = 0; index < BUSINESS_PROFILE_LIMITS.services * 2; index++) {
      capped.set(`services_${index}_name`, `Palvelu ${index}`);
    }
    expect(parseBusinessProfileForm(capped, prospect).services).toHaveLength(BUSINESS_PROFILE_LIMITS.services);
  });

  it('accepts overnight hours through compose, QA, and JSON-LD but rejects equal times', async () => {
    const form = new FormData();
    form.set('name', 'Yögrilli');
    form.set('hours_0_label', 'Ma');
    form.set('hours_0_open', '22:00');
    form.set('hours_0_close', '02:00');
    form.set('exceptions_0_date', '24.12.');
    form.set('exceptions_0_text', 'suljettu');
    const profile = parseBusinessProfileForm(form, prospect);
    expect(validateBusinessProfile(profile)).toEqual([]);
    const data = compose(profile, 'overnight')[0]!;
    expect(validateSiteData(data, { allowR2Photos: true })).toBeNull();
    expect(localBusinessJsonLd(data)).toMatchObject({
      openingHoursSpecification: [expect.objectContaining({ opens: '22:00', closes: '02:00' })],
    });
    const html = bizHtml(data, false);
    expect(html).toContain('22:00–02:00');
    expect(html).toContain('Poikkeusaukiolot');
    expect(html).toContain('<strong>24.12.</strong> suljettu');
    expect(html).toContain('"opens":"22:00","closes":"02:00"');
    const qa = await runQaChecks(data, html, new ControlPlane(workerEnv().DB));
    expect(qa.find((result) => result.id === 'facts.hours')?.passed).toBe(true);

    const equal = validProfile();
    equal.hours = [{ label: 'Ma', open: '09:00', close: '9' }];
    expect(validateBusinessProfile(equal)).toContain('Avaus- ja sulkemisaika eivät voi olla samat.');
    const equalSite = { ...data, sections: [{ kind: 'hours', days: equal.hours }] } as SiteData;
    expect(validateSiteData(equalSite)).toBe('opening and closing times must differ');
    expect(localBusinessJsonLd(equalSite)?.openingHoursSpecification).toBeUndefined();
  });

  it('orders menu groups by first appearance and renders escaped group subheadings', () => {
    const profile = validProfile();
    profile.menu = [
      { name: 'Pasta', group: 'Pääruoat' },
      { name: 'Vesi' },
      { name: 'Kakku', group: 'Jälkiruoat' },
      { name: 'Pizza', group: 'Pääruoat' },
    ];
    const data = compose(profile, 'groups')[0]!;
    const menu = data.sections.find((section) => section.kind === 'services' && section.title === 'Ruokalista');
    expect(menu && menu.kind === 'services' ? menu.items.map((item) => item.name) : []).toEqual([
      'Vesi', 'Pasta', 'Pizza', 'Kakku',
    ]);
    const html = renderSite(data, getTheme(data.meta.themeId)).html;
    const water = html.indexOf('Vesi');
    const mains = html.indexOf('<h3 class="service-group">Pääruoat</h3>');
    const desserts = html.indexOf('<h3 class="service-group">Jälkiruoat</h3>');
    expect(water).toBeGreaterThan(-1);
    expect(water).toBeLessThan(mains);
    expect(mains).toBeLessThan(desserts);

    profile.menu = [{ name: 'X', group: '<script>'.repeat(8) }];
    expect(validateBusinessProfile(profile)).toContain('Ruokalajeja rivillä 1 ryhmä on liian pitkä.');
    const overCap = validProfile();
    overCap.services = Array.from({ length: BUSINESS_PROFILE_LIMITS.services + 1 }, (_, index) => ({
      name: `Palvelu ${index}`,
      group: 'Ryhmä',
    }));
    expect(validateBusinessProfile(overCap)).toContain('Palveluita on liikaa.');
    const invalidSite: SiteData = {
      ...(minimal as SiteData),
      sections: [{ kind: 'services', items: [{ name: 'X', group: 'x'.repeat(61) }] }],
    };
    expect(validateSiteData(invalidSite)).toBe('service too long');
  });

  it('parses sparse panel rows, exceptions, and service groups', () => {
    const current: SiteData = {
      ...(minimal as SiteData),
      capabilities: { hours: true, services: true },
      sections: [
        { kind: 'hours', days: [] },
        { kind: 'services', items: [] },
      ],
    };
    const form = new FormData();
    form.set('hours_27_label', 'Pe');
    form.set('hours_27_open', '22');
    form.set('hours_27_close', '2');
    form.set('exceptions_19_date', '24.12.');
    form.set('exceptions_19_text', 'suljettu');
    form.set('services_39_name', 'Leikkaus');
    form.set('services_39_group', 'Hiukset');
    form.set('services_39_desc', 'x'.repeat(2100));
    const candidate = panelCandidate(current, form);
    expect(candidate.sections).toContainEqual({
      kind: 'hours',
      days: [{ label: 'Pe', open: '22', close: '2' }],
      exceptions: [{ date: '24.12.', text: 'suljettu' }],
    });
    expect(candidate.sections).toContainEqual({
      kind: 'services',
      items: [{ name: 'Leikkaus', group: 'Hiukset', desc: 'x'.repeat(2000) }],
    });
  });
});
