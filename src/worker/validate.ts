import { collectImages, type SiteData } from '../engine/types.js';
import { TEL_URL_RE } from '../engine/escape.js';

const MAX_IMAGE_B64 = 1_100_000;
const DATA_URL_RE = /^data:image\/(?:jpeg|png);base64,([A-Za-z0-9+/=]+)$/;
/** R2 photo reference produced by the mikoshi photo store (see biz.ts). */
const IMG_SRC_RE = /^\/img\/[a-f0-9]{64}$/;

/**
 * A photo is either an inline `{ dataUrl }` (encoding + size checked below via
 * collectImages) or an R2 `{ src: "/img/<sha256>" }` reference. Returns an
 * error string or null.
 */
function photoRefError(photo: unknown, allowR2Photos: boolean): string | null {
  if (!photo || typeof photo !== 'object') return 'bad image';
  const ref = photo as Record<string, unknown>;
  if (typeof ref.src === 'string') {
    if (!allowR2Photos) return 'bad image';
    return IMG_SRC_RE.test(ref.src) ? null : 'bad image reference';
  }
  if (typeof ref.dataUrl === 'string') return null;
  return 'bad image';
}

/** Reject anything that is not a sane, size-capped SiteData. Returns an error string or null. */
export function validateSiteData(
  data: SiteData,
  opts: { allowR2Photos?: boolean } = {},
): string | null {
  const allowR2Photos = opts.allowR2Photos === true;
  if (data?.version !== 1) return 'unsupported data version';
  if (typeof data.name !== 'string' || !data.name.trim()) return 'name is required';
  if (data.name.length > 120) return 'name too long';
  if ((data.tagline ?? '').length > 300) return 'tagline too long';
  if ((data.footerNote ?? '').length > 300) return 'footer note too long';
  if (!Array.isArray(data.links) || data.links.length > 20) return 'too many links';
  for (const link of data.links) {
    if (typeof link?.label !== 'string' || typeof link?.url !== 'string') return 'bad link';
    if (link.label.length > 120 || link.url.length > 500) return 'link too long';
    if (
      (link.kind === 'phone' || /^\s*tel:/i.test(link.url))
      && !TEL_URL_RE.test(link.url)
    ) return 'bad telephone link';
  }
  if (!Array.isArray(data.sections) || data.sections.length > 20) return 'too many sections';
  for (const s of data.sections) {
    if (!s || typeof s !== 'object' || typeof s.kind !== 'string') return 'bad section';
    const text = 'text' in s ? s.text : '';
    if (typeof text === 'string' && text.length > 8000) return 'section text too long';
    if ('title' in s && s.title !== undefined && typeof s.title !== 'string') return 'bad section title';
    switch (s.kind) {
      case 'about':
      case 'contact':
      case 'custom':
        break;
      case 'projects':
        if (!Array.isArray(s.items) || s.items.length > 40) return 'too many items';
        break;
      case 'hobbies':
        if (!Array.isArray(s.items) || s.items.length > 40) return 'too many items';
        break;
      case 'gallery':
        if (!Array.isArray(s.photos) || s.photos.length > 6) return 'too many gallery photos';
        for (const photo of s.photos) {
          const photoError = photoRefError(photo, allowR2Photos);
          if (photoError) return photoError;
        }
        break;
      case 'hours':
        if (!Array.isArray(s.days) || s.days.length > 14) return 'too many opening days';
        for (const day of s.days) {
          if (
            typeof day?.label !== 'string'
            || (day.open !== undefined && typeof day.open !== 'string')
            || (day.close !== undefined && typeof day.close !== 'string')
            || (day.closed !== undefined && typeof day.closed !== 'boolean')
          ) return 'bad opening day';
          if (day.label.length > 120 || (day.open ?? '').length > 50 || (day.close ?? '').length > 50) {
            return 'opening day too long';
          }
        }
        if (s.exceptions !== undefined && !Array.isArray(s.exceptions)) return 'bad opening exceptions';
        if ((s.exceptions?.length ?? 0) > 20) return 'too many opening exceptions';
        for (const exception of s.exceptions ?? []) {
          if (typeof exception?.date !== 'string' || typeof exception?.text !== 'string') {
            return 'bad opening exception';
          }
          if (exception.date.length > 50 || exception.text.length > 300) return 'opening exception too long';
        }
        break;
      case 'services':
        if (!Array.isArray(s.items) || s.items.length > 60) return 'too many services';
        for (const item of s.items) {
          if (
            typeof item?.name !== 'string'
            || (item.desc !== undefined && typeof item.desc !== 'string')
            || (item.price !== undefined && typeof item.price !== 'string')
          ) return 'bad service';
          if (item.name.length > 200 || (item.desc ?? '').length > 2000 || (item.price ?? '').length > 100) {
            return 'service too long';
          }
        }
        break;
      case 'notice':
        if (typeof s.text !== 'string' || s.text.length > 300) return 'notice too long';
        if (s.until !== undefined && (typeof s.until !== 'string' || s.until.length > 100)) return 'bad notice date';
        break;
      case 'location': {
        if (s.address !== undefined && (typeof s.address !== 'string' || s.address.length > 200)) return 'bad address';
        if (s.phone !== undefined && (typeof s.phone !== 'string' || s.phone.length > 200)) return 'bad phone';
        if (s.mapUrl !== undefined) {
          if (typeof s.mapUrl !== 'string' || s.mapUrl.length > 500) return 'bad map URL';
          try {
            const mapUrl = new URL(s.mapUrl);
            if (mapUrl.protocol !== 'http:' && mapUrl.protocol !== 'https:') return 'bad map URL';
          } catch {
            return 'bad map URL';
          }
        }
        break;
      }
      default:
        return 'bad section kind';
    }
  }
  if (data.business !== undefined) {
    if (!data.business || typeof data.business !== 'object') return 'bad business metadata';
    if (data.business.phone !== undefined && (typeof data.business.phone !== 'string' || data.business.phone.length > 200)) {
      return 'bad business phone';
    }
    if (data.business.address !== undefined && (typeof data.business.address !== 'string' || data.business.address.length > 200)) {
      return 'bad business address';
    }
    if (data.business.city !== undefined && (typeof data.business.city !== 'string' || data.business.city.length > 60)) {
      return 'bad business city';
    }
    if (data.business.yTunnus !== undefined && (typeof data.business.yTunnus !== 'string' || data.business.yTunnus.length > 100)) {
      return 'bad business identifier';
    }
  }
  if (data.capabilities !== undefined) {
    if (!data.capabilities || typeof data.capabilities !== 'object') return 'bad capabilities';
    if (Object.values(data.capabilities).some((value) => value !== undefined && typeof value !== 'boolean')) {
      return 'bad capabilities';
    }
  }
  if (data.photo) {
    const photoError = photoRefError(data.photo, allowR2Photos);
    if (photoError) return photoError;
  }
  for (const [, dataUrl] of collectImages(data)) {
    const m = dataUrl.match(DATA_URL_RE);
    if (!m) return 'bad image encoding';
    if (m[1]!.length > MAX_IMAGE_B64) return 'an image is too large';
  }
  if (typeof data.meta?.themeId !== 'string') return 'missing theme';
  if (data.meta.hideBranding !== undefined && typeof data.meta.hideBranding !== 'boolean') {
    return 'bad branding preference';
  }
  if (data.lang !== undefined && !/^[a-z]{2,3}(-[a-zA-Z0-9-]{1,10})?$/.test(data.lang)) {
    return 'bad language code';
  }
  const cp = data.meta.customPalette;
  if (cp !== undefined) {
    const hexes = [cp?.bg, cp?.surface, cp?.text, cp?.muted, cp?.accent];
    if (hexes.some((h) => typeof h !== 'string' || !/^#[0-9a-f]{6}$/.test(h))) {
      return 'bad custom colors';
    }
  }
  return null;
}
