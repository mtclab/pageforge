/**
 * Security headers for every response this worker sends (#52).
 *
 * wrangler.toml sets `run_worker_first = true`, so static assets also pass
 * through the worker and get the same headers as the worker's own responses.
 * One helper, every response: `withSecurityHeaders`.
 *
 * The CSPs are built from what the pages actually load
 * (test/security-headers.test.ts parses every page and fails when a script,
 * stylesheet, image or inline script is not admitted):
 *
 * App pages (/, /make, /help, 404, the theme workbench):
 * - scripts: same-origin bundles (app.js, landing.js) + the one inline
 *   fragment-forwarding script in index.html, admitted by its hash.
 * - styles: same-origin ui.css + inline <style>. Inline is required: the live
 *   preview is an iframe srcdoc with the generated stylesheet inlined (srcdoc
 *   documents inherit this policy), help.html carries a page-local <style>,
 *   and the print-cards window is a written about:blank document.
 * - images: same-origin, data: (photos, favicons, the OG card preview are
 *   data URLs) and blob:.
 * - connect: same-origin only (/api/*).
 * - fonts: system stacks only; nothing is downloaded.
 *
 * Hosted pages (/s/<slug>/): what the render engine emits and nothing else -
 * a same-origin stylesheet and images, plus the constant email-activation
 * script, admitted by its hash.
 */

/** sha256 of the inline script in src/static/index.html (test-pinned). */
export const LANDING_INLINE_SCRIPT_HASH = "'sha256-5awBV/FO4znWTQN70eBlUU3yqGKefmVvAsDFvVpe+eY='";
/** sha256 of EMAIL_ACTIVATION_SCRIPT in src/engine/links.ts (test-pinned). */
export const EMAIL_SCRIPT_HASH = "'sha256-RHLqrreoOuctHvHWItWWray7KhJSA8yBVhUhYafGvXA='";

export const APP_CSP = [
  "default-src 'self'",
  `script-src 'self' ${LANDING_INLINE_SCRIPT_HASH}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export const HOSTED_CSP = [
  "default-src 'none'",
  `script-src ${EMAIL_SCRIPT_HASH}`,
  "style-src 'self'",
  "img-src 'self' data:",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

export function securityHeaders(csp: string): Record<string, string> {
  return {
    'content-security-policy': csp,
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
  };
}

/**
 * A copy of `response` carrying the security headers. Responses from fetch()
 * and Response.redirect() have immutable headers, so this always rebuilds.
 */
export function withSecurityHeaders(response: Response, csp: string = APP_CSP): Response {
  const out = new Response(response.body, response);
  for (const [name, value] of Object.entries(securityHeaders(csp))) out.headers.set(name, value);
  return out;
}
