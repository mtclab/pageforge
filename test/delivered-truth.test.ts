// @vitest-environment happy-dom
//
// Standing gates from the 2026-09 product-truth walk. Each asserts the OUTCOME a
// person reaches - the page inside the zip, the README beside it, the tick on
// the screen - rather than that some function returned a value. All three were
// proven red against the code as it shipped on f88213e.
import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { renderDownloadStep } from '../src/app/steps/download.js';
import { buildDownloadFiles, buildZip } from '../src/engine/bundle.js';
import { renderSite } from '../src/engine/render.js';
import type { SiteData, Section } from '../src/engine/types.js';
import { THEMES } from '../src/themes/index.js';
import minimal from './fixtures/minimal.json';

const BASE = minimal as unknown as SiteData;
const theme = THEMES[0]!;

function withLinks(links: { label: string; url: string }[]): SiteData {
  return { ...BASE, links } as SiteData;
}

/** The delivered artifact, read back the way the person's computer reads it. */
function delivered(data: SiteData): Record<string, string> {
  const files = unzipSync(buildZip(buildDownloadFiles(data, theme)));
  const out: Record<string, string> = {};
  const dec = new TextDecoder();
  for (const [path, bytes] of Object.entries(files)) {
    if (path.endsWith('.html') || path.endsWith('.md') || path.endsWith('.json')) {
      out[path] = dec.decode(bytes);
    }
  }
  return out;
}

describe('a bare email address in the links field reaches the page as an email', () => {
  // The field's own hint is "Paste a link (Instagram, email, anything) - the
  // icon is picked for you", so people type the address bare. Before the fix
  // safeUrl prepended https://, turning `me@example.com` into a link to the
  // HOST example.com with the address as userinfo: a broken link, the wrong
  // icon, and the address sitting in the href as plain text for harvesters.
  const data = withLinks([{ label: 'Email me', url: 'anna@example.com' }]);

  it('is a mailto, not an https host', () => {
    const { html } = renderSite(data, theme);
    expect(html).not.toContain('https://anna@example.com');
    expect(html).toContain('data-email-a="mailto:');
  });

  it('never puts the whole address in the page, in any single attribute', () => {
    const { html } = renderSite(data, theme);
    expect(html).not.toContain('anna@example.com');
    for (const attr of html.matchAll(/="([^"]*)"/g)) {
      expect(attr[1]).not.toContain('anna@example.com');
    }
  });

  it('carries the email icon, not the globe', () => {
    const doc = new DOMParser().parseFromString(renderSite(data, theme).html, 'text/html');
    const link = doc.querySelector('.links a[data-email-a]');
    expect(link).not.toBeNull();
    // the email glyph is the envelope path; the globe is the fallback kind
    expect(link!.querySelector('svg')!.innerHTML).toContain('M2 5v14h20V5H2z');
  });

  it('survives into the downloaded zip', () => {
    const files = delivered(data);
    expect(files['website/index.html']).toContain('data-email-a="mailto:');
    expect(files['website/index.html']).not.toContain('anna@example.com');
  });

  it('does not swallow real hosts, userinfo URLs or anything with a scheme', () => {
    const { html } = renderSite(
      withLinks([
        { label: 'Site', url: 'example.com' },
        { label: 'Deep', url: 'example.com/a@b' },
        { label: 'Explicit', url: 'mailto:x@example.com' },
        { label: 'Scheme', url: 'https://user@example.com/p' },
      ]),
      theme,
    );
    expect(html).toContain('href="https://example.com/"');
    expect(html).toContain('href="https://example.com/a@b"');
    expect(html).toContain('href="https://user@example.com/p"');
  });
});

describe('the README describes the reader\'s own answers truthfully', () => {
  // It warned every reader that site.json holds "your email address written out
  // in full" and that the page hides it from harvesters - true only for sites
  // that actually carry an address.
  it('a site with no email is not told its file holds one', () => {
    const readme = delivered(withLinks([{ label: 'Site', url: 'example.com' }]))['README.md']!;
    expect(readme).not.toContain('email address');
  });

  it('a site with an email keeps the warning that earns its place', () => {
    const readme = delivered(withLinks([{ label: 'Email me', url: 'anna@example.com' }]))['README.md']!;
    expect(readme).toContain('email address written out in full');
    expect(readme).toContain('address-harvesting robots');
  });

  it('a contact section with an address counts too', () => {
    const data = { ...BASE, sections: [{ kind: 'contact', email: 'anna@example.com' }] as Section[] } as SiteData;
    expect(delivered(data)['README.md']).toContain('email address written out in full');
  });
});

describe('the pre-download checklist matches the page the zip contains', () => {
  // "At least one section with content" was ticked by `sections.length > 0`, so
  // a section the user added and left empty - which the renderer drops - still
  // read as content. The tick has to mean what the page shows.
  const check = (data: SiteData): boolean => {
    const pane = document.createElement('div');
    renderDownloadStep(pane, { data, onChange: () => {} } as never);
    const row = [...pane.querySelectorAll('.checklist li')].find((li) =>
      li.textContent!.includes('At least one section with content'),
    );
    expect(row, 'the checklist row must exist').toBeDefined();
    return row!.classList.contains('ok');
  };

  const renders = (data: SiteData): boolean => renderSite(data, theme).html.includes('<section');

  it('an empty section is not counted as content', () => {
    const data = { ...BASE, sections: [{ kind: 'gallery', photos: [] }, { kind: 'about', text: '  ' }] as Section[] } as SiteData;
    expect(renders(data)).toBe(false);
    expect(check(data)).toBe(false);
  });

  it('a filled section is', () => {
    const data = { ...BASE, sections: [{ kind: 'about', text: 'I draw maps.' }] as Section[] } as SiteData;
    expect(renders(data)).toBe(true);
    expect(check(data)).toBe(true);
  });

  it('the tick and the page never disagree, for every section kind', () => {
    const cases: Section[][] = [
      [],
      [{ kind: 'gallery', photos: [] }],
      [{ kind: 'hobbies', items: [] }],
      [{ kind: 'projects', items: [] }],
      [{ kind: 'contact' }],
      [{ kind: 'custom', title: '', text: '' }],
      [{ kind: 'custom', title: 'Notes', text: 'Something.' }],
      [{ kind: 'hobbies', items: ['Maps'] }],
      [{ kind: 'gallery', photos: [] }, { kind: 'about', text: 'Hello.' }],
    ];
    for (const sections of cases) {
      const data = { ...BASE, sections } as SiteData;
      expect(check(data), JSON.stringify(sections)).toBe(renders(data));
    }
  });
});

