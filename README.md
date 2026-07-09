# pageforge

Personal homepage generator. Users answer a short wizard, pick a theme, and download their complete static site as a zip (index.html + style.css + assets + a hand-holding deploy README). Everything runs in the browser - the Cloudflare Worker serves static assets only, no server code, no accounts, no tracking. Photos never leave the user's device.

## Architecture

- `src/engine/` - pure, DOM-free render engine (also runs in Node for tests). `renderSite(data, theme)` -> `{html, css}`. Deterministic: same inputs, byte-identical output (fixed zip mtime, no clock/randomness).
- `src/themes/` - theme packs as data: one `theme.ts` per theme (structural CSS string + palettes + system font stacks). Registry in `src/themes/index.ts`. Every palette must pass the WCAG AA contrast test.
- `src/app/` - the wizard (vanilla TS, no framework). 4 steps: You / Look / Style / Download. Draft persists in localStorage. Zip built client-side with fflate.
- `src/static/` - app shell, copied verbatim to `dist/`.

## Commands

```
npm test          # vitest: snapshots, escaping, zip contents, determinism, palette contrast
npm run typecheck
npm run build     # esbuild -> dist/
npm run dev       # esbuild watch + serve on :8787 (static copies not watched)
npm run sample    # render the full.json fixture to stdout (--out DIR writes files)
npm run deploy    # build + wrangler deploy (assets-only worker)
```

## Adding a theme

1. `src/themes/<id>/theme.ts` exporting a `ThemePack` (copy slate as the pattern).
2. Register it in `src/themes/index.ts`.
3. `npm test` - snapshots for the new theme are created, contrast test must pass.
4. Eyeball every palette at `/#gallery` (theme workbench, renders the full fixture in all combinations).

## Deploy

Assets-only worker (`wrangler.toml` has no `main`). `npm run deploy` with a Cloudflare API token in the environment. workers.dev first; `pageforge.mtclab.net` custom domain later.
