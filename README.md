# pageforge

Personal homepage generator, plus a staging-only business-site control plane
(the "mikoshi" surface).

**Generator:** users answer a short wizard, pick a theme, and download their
complete static site as a zip (index.html + style.css + assets + a
hand-holding deploy README). Everything runs in the browser; photos never
leave the user's device. No accounts, no tracking.

**Business control plane (staging-only, closed by default):** a D1/R2-backed
service loop for Finnish small-business card sites - prospect intake,
deterministic draft composer, tokenized previews, staged proposals with human
approval, QA gate, orders, provisioning state machine, export/offboarding.
Every route in it returns 404 unless `MUTATION_API_ENABLED=true` and
`OPERATOR_KEY` are set; production deploys keep the flag off. See
`docs/MIKOSHI_BUILD_PLAN.md` and `docs/MUTATION_API.md`.

## Architecture

- `src/engine/` - pure, DOM-free render engine (also runs in Node for tests). `renderSite(data, theme)` -> `{html, css}`. Deterministic: same inputs, byte-identical output (fixed zip mtime, no clock/randomness). Business extras: fi/en/sv labels (`localization.ts`), LocalBusiness JSON-LD (`jsonld.ts`).
- `src/themes/` - theme packs as data: one `theme.ts` per theme (structural CSS string + palettes + system font stacks). Registry in `src/themes/index.ts`. Every palette must pass the WCAG AA contrast test.
- `src/app/` - the wizard (vanilla TS, no framework). 4 steps: You / Look / Style / Download. Draft persists in localStorage. Zip built client-side with fflate.
- `src/static/` - app shell, copied verbatim to `dist/`.
- `src/worker/` - the Worker: static assets + share/publish routes, and the flag-gated business control plane (`db.ts` ControlPlane over D1, `admin.ts` operator console, `biz.ts` mutation API, `mcp.ts` propose-only MCP, `panel.ts` customer panel, `payments.ts`/`billing.ts` orders, `provisioning.ts`, `qa.ts`, `store-zip.ts` export).
- `migrations/` - D1 schema (apply with `npx wrangler d1 migrations apply pageforge-mikoshi --local` for staging).

## Commands

```
npm test          # vitest: snapshots, escaping, zip contents, determinism, palette contrast, control-plane suites
npm run typecheck
npm run build     # esbuild -> dist/
npm run dev       # esbuild watch + serve on :8787 (static copies not watched)
npm run sample    # render the full.json fixture to stdout (--out DIR writes files)
npm run deploy    # build + wrangler deploy
```

## Staging (business control plane)

Never run `wrangler dev` for live testing on the workspace machine - use the
staging box. On the box: pull `dev`, `npm install && npm run build`, apply D1
migrations `--local`, put `MUTATION_API_ENABLED=true` + `OPERATOR_KEY=...` in
`.dev.vars`, then `npx wrangler dev --port 8795 --ip 127.0.0.1`. Prod deploys
only from `main`; the flag stays `false` in `wrangler.toml`.

## Adding a theme

1. `src/themes/<id>/theme.ts` exporting a `ThemePack` (copy slate as the pattern).
2. Register it in `src/themes/index.ts`.
3. `npm test` - snapshots for the new theme are created, contrast test must pass.
4. Eyeball every palette at `/#gallery` (theme workbench, renders the full fixture in all combinations).

## Deploy

`npm run deploy` with a Cloudflare API token in the environment. Production =
merge to `main` (CI dispatch-only); the mikoshi surface ships dark (flag off,
placeholder D1/R2 ids in `wrangler.toml` must be provisioned before the flag
ever turns on in prod).
