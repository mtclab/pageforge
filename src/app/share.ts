import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import type { SiteData } from '../engine/types.js';
import { decodeSiteData } from './site-data.js';

/**
 * Share-preview links: the whole SiteData (minus the photo - too big for a
 * URL) compressed into the #s= fragment. Nothing is uploaded anywhere; the
 * recipient's browser renders the page locally.
 */

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replaceAll('-', '+').replaceAll('_', '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function encodeShare(data: SiteData, base?: string): string {
  const shared: SiteData = { ...data };
  delete shared.photo;
  const packed = deflateSync(strToU8(JSON.stringify(shared)), { level: 9 });
  const prefix = base ?? `${location.origin}${location.pathname}`;
  return `${prefix}#s=${toBase64Url(packed)}`;
}

export function decodeShare(hash: string): SiteData | null {
  const m = hash.match(/^#s=([A-Za-z0-9_-]+)$/);
  if (!m) return null;
  try {
    const parsed = decodeSiteData(JSON.parse(strFromU8(inflateSync(fromBase64Url(m[1]!)))));
    if (!parsed) return null;
    delete parsed.photo; // share links never carry photos
    return parsed;
  } catch {
    return null;
  }
}
