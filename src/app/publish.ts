import { slugify } from '../engine/bundle.js';
import type { SiteData } from '../engine/types.js';
import { getTheme } from '../themes/index.js';
import { el } from './dom.js';
import { renderOgCard } from './og.js';

const PUBLISHED_KEY = 'pageforge-published-v1';

interface PublishedRecord {
  slug: string;
  editKey: string;
  url: string;
}

function loadPublished(): PublishedRecord[] {
  try {
    const raw = localStorage.getItem(PUBLISHED_KEY);
    if (raw) return JSON.parse(raw) as PublishedRecord[];
  } catch {
    // fall through
  }
  return [];
}

function savePublished(records: PublishedRecord[]): void {
  try {
    localStorage.setItem(PUBLISHED_KEY, JSON.stringify(records));
  } catch {
    // storage blocked: the edit key shown on screen is the only copy
  }
}

/** "Or put it online right here" box on the download step. Beta. */
export function renderPublishBox(data: SiteData): HTMLElement {
  const box = el('div', { class: 'group publish-box' });
  box.append(
    el('h3', {}, 'Or put it online right here ', el('span', { class: 'beta-tag', text: 'beta' })),
    el('p', {
      class: 'hint',
      text: 'One click, no account. You get an address like pageforge.mtclab.net/s/your-name. An edit key is saved in this browser so you can update or remove the page later.',
    }),
  );

  const slugInput = el('input', { type: 'text', 'aria-label': 'Your address', placeholder: 'your-name' });
  slugInput.value = slugify(data.name) === 'my' ? '' : slugify(data.name);
  const status = el('span', { class: 'hint', text: '' });
  const prefix = el('span', { class: 'slug-prefix', text: '/s/' });
  box.append(el('div', { class: 'row slug-row' }, prefix, slugInput, status));

  const records = loadPublished();
  const recordFor = (slug: string) => records.find((r) => r.slug === slug);

  let checkTimer: ReturnType<typeof setTimeout> | undefined;
  slugInput.addEventListener('input', () => {
    clearTimeout(checkTimer);
    const slug = slugInput.value.trim().toLowerCase();
    status.textContent = '';
    publishBtn.textContent = recordFor(slug) ? 'Update your page' : 'Publish';
    if (!slug) return;
    checkTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/check?slug=${encodeURIComponent(slug)}`);
        const body = (await res.json()) as { available: boolean; invalid?: boolean };
        if (body.invalid) status.textContent = 'Letters, numbers and dashes only (3-40).';
        else if (body.available || recordFor(slug)) status.textContent = 'Available!';
        else status.textContent = 'Taken.';
      } catch {
        status.textContent = '';
      }
    }, 350);
  });

  const publishBtn = el('button', {
    type: 'button',
    class: 'primary',
    text: recordFor(slugInput.value) ? 'Update your page' : 'Publish',
  });
  const result = el('div', { class: 'publish-result' });

  publishBtn.addEventListener('click', async () => {
    const slug = slugInput.value.trim().toLowerCase();
    if (!slug) {
      status.textContent = 'Pick an address first.';
      return;
    }
    publishBtn.disabled = true;
    publishBtn.textContent = 'Publishing...';
    result.replaceChildren();
    try {
      const existing = recordFor(slug);
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug,
          editKey: existing?.editKey,
          data,
          ogPng: renderOgCard(data, getTheme(data.meta.themeId)),
        }),
      });
      const body = (await res.json()) as { url?: string; editKey?: string; error?: string };
      if (!res.ok || !body.url) {
        result.append(el('p', { class: 'error', text: body.error ?? 'Publishing failed. Try again.' }));
        return;
      }
      if (!existing && body.editKey) {
        records.push({ slug, editKey: body.editKey, url: body.url });
        savePublished(records);
      }
      const link = el('a', { href: body.url, target: '_blank', rel: 'noopener', text: body.url });
      result.append(
        el('p', { class: 'publish-ok' }, 'Your page is live: ', link),
        el('p', {
          class: 'hint',
          text: 'The edit key is saved in this browser. Publishing again with the same address updates the page.',
        }),
      );
      const remove = el('button', { type: 'button', class: 'chip danger', text: 'Remove from the internet' });
      remove.addEventListener('click', async () => {
        if (!confirm('Take this page offline? The address becomes free for anyone to claim.')) return;
        const rec = recordFor(slug);
        if (!rec) return;
        const del = await fetch(`/api/site/${slug}`, {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ editKey: rec.editKey }),
        });
        if (del.ok) {
          savePublished(records.filter((r) => r.slug !== slug));
          result.replaceChildren(el('p', { class: 'hint', text: 'Removed.' }));
        }
      });
      result.append(remove);
    } catch {
      result.append(el('p', { class: 'error', text: 'Publishing failed. Check your connection and try again.' }));
    } finally {
      publishBtn.disabled = false;
      publishBtn.textContent = recordFor(slugInput.value.trim().toLowerCase()) ? 'Update your page' : 'Publish';
    }
  });

  box.append(publishBtn, result);
  return box;
}
