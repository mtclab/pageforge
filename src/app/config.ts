/**
 * Feature flags. Hosted publish is built and works end-to-end, but stays OFF
 * until the abuse story (moderation, quotas, maybe payment gate) is settled.
 * Flip: set PUBLISH_ENABLED to true here AND set PUBLISH_ENABLED = "true" in
 * wrangler.toml [vars] - the server refuses independently of the client.
 * Owner can test the UI in production via localStorage:
 *   localStorage.setItem('pageforge-publish-beta', '1')
 */
const PUBLISH_ENABLED = false;

export function publishEnabled(): boolean {
  if (PUBLISH_ENABLED) return true;
  try {
    return localStorage.getItem('pageforge-publish-beta') === '1';
  } catch {
    return false;
  }
}
