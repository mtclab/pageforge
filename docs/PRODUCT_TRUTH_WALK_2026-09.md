# Product-truth walk, September 2026 - PageForge

A non-technical person's walk of the shipped site: the shop window, the wizard
from a clean browser through all four steps, a photo and its crop, all fifteen
looks, the Style step, the zip - downloaded, unzipped, and opened standalone the
way the README tells them to - the share link, loading the zip back in, the
theme workbench, and a 390px phone. Plus the hosted-publish flag, which must
stay dark and must not leak a half-built feature into the delivery moment.

**Nothing in this file is decided.** Three defects the walk met were plain bugs
and are fixed on this branch with standing gates; everything else is written up
as a PROPOSAL, because the fix is a design or copy call and those are the
owner's.

**Venue.** Production, https://pageforge.mtclab.net, `/version` reporting
`f88213e` - the same commit this branch is cut from. Driven by Playwright from
the staging box (the MCP browser cannot launch in this workspace), from a clean
context, and the downloaded zip opened from `file://` exactly as the README's
"double-click index.html" instructs.

---

## 1. The findings

| id | sev | what the person sees | cause | fixed here |
| --- | --- | --- | --- | --- |
| P-01 | HIGH | The links field says "Paste a link (Instagram, email, anything) - the icon is picked for you". Typing `anna@example.com` produces, on the finished page, `<a href="https://anna@example.com/">` drawn with the GLOBE icon. It is not a mail link, it goes to `example.com`, and the address sits in the href as plain text - which the zip's own README promises it does not ("the page itself hides that address from address-harvesting robots"). The one link that matters most on a personal homepage, silently broken. | `safeUrl` (`src/engine/escape.ts:22-24`) prepends `https://` to anything without a scheme, so a bare address becomes the userinfo of a host. `detectKind` then reads the hostname and returns `website`, and `renderLinks` (`src/engine/links.ts:103`) never reaches the mailto branch, so `obfuscatedEmailLink` never runs. Every existing test used `mailto:a@b.com`, with the scheme already on it. | YES |
| P-02 | MED | The zip's README tells every author that `site.json` holds "your email address written out in full" and warns them twice about harvesters - including authors whose site has no email anywhere. | `renderReadme` (`src/engine/readme.ts:19, 44`) emits both sentences unconditionally; the only conditional it took was `hasPhoto`. | YES |
| P-03 | MED | "Quick check" ticks "At least one section with content" for a section the author added and left empty - and the renderer drops empty sections, so their page does not contain it. Walked: a Photo gallery with no photos, ticked green, absent from the delivered `index.html`. | `src/app/steps/download.ts:41` - `data.sections.some((s) => 'text' in s && s.text.trim()) \|\| data.sections.length > 0`. The `\|\|` makes the real test dead code. | YES |
| P-04 | MED | The Download step shows a rendered share card under "When someone shares your page, it can look like this:". The zip it hands over carries no `og:image` at all, so no messenger will show that card. | By design and correct as far as it goes: `og:image` must be absolute, and a zip download has no address yet, so `renderSite` omits it (`src/engine/render.ts:159-162, 210-213`). The preview does not know that, and the sentence promises the outcome. | no - see 2.1 |
| P-05 | MED | Mistype a path and you get a blank white page. `https://pageforge.mtclab.net/nonexistent-page` is a 404 with an empty body: no message, no link home, no way back. | The Worker falls through to `env.ASSETS.fetch(request)` (`src/worker/index.ts:285`) and Workers Assets answers its own bare 404. No `not_found_handling` is configured in `wrangler.toml`. | no - see 2.2 |
| P-06 | MED | The wizard accepts a section, ticks it, saves it in the draft, shows it in `site.json` - and drops it from the page, with nothing anywhere saying so. Walked with an empty gallery; the same holds for an empty hobbies, projects, contact or untitled custom section. | Each renderer returns `''` when empty (`src/engine/sections/blocks.ts:45, 63, 80, 106, 123, 136`). Right behaviour, invisible to the author. The live preview shows the truth, but only if they look. | no - see 2.3 |
| P-07 | LOW | The landing's grid of fifteen looks is lazy: only the first four are painted until the reader scrolls. Anything that renders the page without scrolling - a screenshot service, a link-preview crawler, a print - sees eleven empty frames directly under the sentence "Every look below is a real page rendered right now in your browser, not a picture of one." | `lazyFrame` (`src/app/landing.ts:31-45`) paints on IntersectionObserver with a 400px root margin, and the `<iframe>` has no fallback content. Verified: correct for a real scrolling reader, all fifteen fill in. | no - see 2.4 |
| P-08 | LOW | The header's Help link is `help.html`, which 307-redirects to `/help` on every click. | `src/static/index.html`; Workers Assets normalises the extension away. One extra round trip on a link in the site header. | no |
| P-09 | LOW | The theme workbench at `/make#gallery` renders 45 combinations correctly, with the browser tab still reading "Make your page - pageforge". | The workbench reuses the wizard shell and never sets its own title. | no |
| P-10 | LOW | The page carries no Content-Security-Policy. | Nothing on this origin needs one today - the app is a static bundle and every preview is an `srcdoc` iframe with `sandbox="allow-same-origin"` and no `allow-scripts` - but the whole product's promise is "your text and photos never leave this browser", and a CSP is how that promise is made mechanical rather than merely true. | no - see 2.5 |

Checked and correct, for the record: `javascript:` in a link renders as inert plain text, and `<script>` and `<b>` in the name and tagline arrive escaped in the title, the `og:title`, the `alt` and the `<h1>`; the delivered `index.html` opens from `file://` with zero console errors and zero failed requests; every path in it is relative, with no absolute path and no leaked draft; the crop UI takes a 400x900 portrait, zooms and commits; all fifteen themes render the author's own content in the preview and in the zip; there is no horizontal overflow at 390px on the landing, on any of the four wizard steps, or on the delivered page; the share link round-trips into a clean browser with no draft and shows the shared view; loading the zip back in restores the draft and lists it under "My pages"; the publish flag is properly dark - `/api/*` answers 503 with a message that points at the zip instead of apologising, `/s/*` is 404, and the words "publish", "host", "beta" and "coming later" appear nowhere on the public Download step.

---

## 2. Proposals

### 2.1 P-04 - a share card the download cannot deliver

The card is real, it is drawn from the author's own data, and it is what they
WOULD get if the page were hosted. The sentence above it is the problem: "When
someone shares your page, it can look like this" reads as a description of what
will happen, and for a zip download it is not.

Three ways out, ascending:

1. **Change the sentence.** "This is the card your page can show once it has an
   address - add it in step 4 and the card ships with your zip." One string.
2. **Ask for the address.** The Download step already has an address field, for
   the QR code. If that field also fed `renderSite`'s `baseUrl`, the zip could
   carry `og.png`, `og:image`, `og:url` and `canonical` - everything the hosted
   path already produces. The author usually knows their address by the time
   they come back for the QR code, and this makes one field do two jobs instead
   of asking twice.
3. **Ship `og.png` unconditionally** and emit a relative `og:image`. Cheapest to
   build and the worst of the three: relative `og:image` is ignored by most
   scrapers, so it would make the promise look kept without keeping it.

Overseer's recommendation is (2), with (1) as the stopgap. (2) is the one that
makes the preview true rather than merely honest about being untrue.

### 2.2 P-05 - the blank 404

A person who mistypes, or follows an old link, lands on nothing at all. This is
the one dead-end in an otherwise dead-end-free product, and it is the cheapest
fix in this document: `[assets] not_found_handling = "404-page"` in
`wrangler.toml` plus a `dist/404.html` in the house style - one sentence, a link
to `/`, a link to `/make`. Roughly twenty lines and no code.

While that file is open: `/s/:slug` is NOT behind `PUBLISH_ENABLED`
(`src/worker/index.ts:267`), so any page ever published while the flag was open
stays served after it closes. That is arguably right - taking someone's page
down because a flag moved would be worse - but it is worth being a deliberate
decision rather than an accident of where the guard was placed.

### 2.3 P-06 - the section that vanishes

Dropping an empty section from the finished page is correct: nobody wants a bare
"Photo gallery" heading over nothing. The trouble is that the wizard gives no
sign it is going to happen. The author adds the section, fills nothing, and the
page they download is missing something they believe they put there.

P-03's fix makes the checklist stop LYING about it, which is the half that was a
plain bug. The other half is a nudge: an empty section block could carry a quiet
line of its own - "empty sections are left off your page" - or the section header
in the editor could dim while it has no content. Either is a copy change in
`src/app/steps/content.ts`. The live preview already tells the truth, so this is
about the author who does not look at it.

### 2.4 P-07 - fifteen looks, four of them painted

The lazy paint is the right call: fifteen live pages is a lot to boot, and it
works for a person who scrolls. What it does not survive is being rendered
without a scroll, which is exactly what a link-preview crawler, a screenshot
tool or a print does - and this is the page most likely to be screenshotted,
because it is the shop window.

Cheapest fix: give each `<iframe>` fallback content (a static thumbnail, or even
the theme's own name and palette dots as an SVG) so an unpainted frame reads as
a card rather than a hole. A larger `rootMargin`, or painting the first row of
four eagerly and the rest lazily - which is what already happens by accident -
is the other half.

### 2.5 P-10 - the promise, made mechanical

"Your text and photos never leave your browser" is the product. Today that is
true because there is nothing in the bundle that would send them - a fact that
holds by inspection rather than by construction. A CSP with
`connect-src 'self'`, `img-src 'self' data: blob:` and `frame-src 'self'` on the
generator's own pages would make it impossible for a future dependency, or a
future feature, to quietly break the promise; and `default-src 'none'` on the
`/s/:slug` hosted pages would bound what a hostile SiteData could ever reach.
Neither changes anything a user sees. Cheap, and it belongs to the same family
as the `sandbox` attribute already on every preview iframe.

---

## 3. Depth: would a person publish this?

**Yes.** That is the headline, and it is not a small thing. The zip contains a
complete, self-contained, dependency-free site: 3.2KB of clean semantic HTML,
one readable stylesheet, a favicon drawn from the author's own name, their photo
centre-cropped to 512x512, and a README that is genuinely the best-written file
in the product. Opened from `file://` it renders perfectly - the terminal theme
in particular has real character, and it is a page someone would be pleased to
put their name on. There are no absolute paths, no build step, no framework, no
tracking, and no leaked draft. The escaping holds against hostile input on every
surface the walk could reach. The "keep the file" promise is kept literally.

**Where the wizard is thin.** Not in options - the Style step alone carries 57
controls across seven bands, plus vibes presets, a five-colour custom palette
with contrast guarding, save-your-own-look and look export/import. It is thin in
two other places:

- **Content shape.** Six section kinds, all of them lists or blocks of plain
  text. No markdown, no links inside prose, no dates, no images inside a text
  section. A personal homepage that wants "here is a thing I wrote, with a link
  in the middle of the sentence" cannot have one. This is the ceiling most
  authors will hit second.
- **One page.** The product is a single page by design and says so. The
  demand-gated multi-page idea in memory is the honest next question, and it is
  a bigger change than it looks: the zip layout, the README, the share link, the
  site.json shape and the hosted path all assume one document.

**What a second theme family would need.** The theme contract is in good shape
for it. A `ThemePack` is a structural CSS string plus palettes plus font stacks,
consuming CSS custom properties (`--page-max`, `--text-factor`, `--photo-radius`
and the surface/corner/shadow/density vars) that the Style step owns, with a
lint test that forbids hardcoding them and a per-theme override matrix. Adding a
theme is a file, a registry line, a snapshot and a contrast pass. So a second
family costs almost nothing structurally - but it would want three things the
current fifteen do not have:

1. **Bundled fonts.** Every theme today is a no-download system stack, which is
   the right default and also the reason fifteen looks share a certain sobriety.
   A display family - the "weekend clothes" house in `IDENTITY_SYSTEM.md` - needs
   real woff2 in the zip, which means a size budget, a licence audit, and a
   choice about whether the zip stays this small.
2. **A layout axis, not just a skin.** All fifteen are one column: hero, then
   stacked sections. Ink and Gazette differ in type and colour, not in shape. A
   family that offered a sidebar, a two-column grid, or a link-hub layout would
   need `renderSite` to have more than one arrangement, and the Style step's
   Layout band to know which arrangements a theme supports.
3. **Content blocks the family needs.** A portfolio family wants a project grid
   with images; a link-hub family wants big tap targets and no prose; an event
   family wants a date, a place and a map link. Which is to say a second theme
   family is really a content-model question wearing a visual-design costume,
   and the content model is the thinner half.

**On the brand.** The landing avoids every tell on the standing kill-list: no
system-ui body text, no generic blue, no emoji-as-icon, no uniform auto-fill
card grid with lift-on-hover, no background gradient. It reads as a serif print
shop, the "Built by MTC Lab" mark is on it, and the hero's stacked sheets are a
real idea rather than a stock illustration. This is one of the better-looking
things in the estate.

---

## 4. What could not be exercised

- **Hosted publish, for real.** The server flag is off, so `/api/publish`
  answers 503 by design. The client-side owner override
  (`localStorage['pageforge-publish-beta'] = '1'`) does reveal the publish box
  in production - correct, that is what the override is for - but a publish from
  it cannot reach a working server, so slug collision, the edit key, updating a
  page and deleting one were all read in `src/worker/index.ts` rather than
  walked.
- **The photo gallery section end to end.** Photos were added to the wizard but
  the multi-file gallery upload and its 6-photo cap were not driven; the
  gallery's empty state is what produced P-03 and P-06.
- **The QR code and print cards.** Both need a live address for the finished
  page, which this walk had no way to produce with publishing dark. The
  validation on that field was exercised; the outputs were not.
- **Real mobile hardware.** 390px was driven as an emulated viewport with touch,
  not on a phone. Tap-target sizes and the crop gesture on a real touchscreen
  are unverified.
- **The MCP browser.** Chrome will not launch in this workspace (the sandbox
  refuses the zygote's namespace), so the whole walk ran from the staging box.
  Screenshots are in the session scratchpad.
