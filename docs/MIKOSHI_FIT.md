# Pageforge fit for the Mikoshi website service

Date: 2026-07-15

## Bottom line

Recommendation: go, but only as a human-supervised assembly line. Do not position the current repository as a fully automated Mikoshi service.

Pageforge already has the hard-to-rebuild core of a safe, deterministic static one-page generator: structured `SiteData`, 15 responsive theme packs, browser preview, local draft editing, ZIP export, importable `site.json`, and a disabled KV-backed hosted-publish beta. It can replace most repetitive HTML/CSS assembly once business facts and approved copy are available.

It does not yet have the service control plane. There is no structured prospect intake, AI-assisted copy drafting, durable customer or order record, private staging lifecycle, custom-domain routing, `.fi` registration or renewal, mailbox provisioning, payment or VAT flow, update queue, operator dashboard, or contractual offboarding process. The current generator also lacks first-class business hours, postal address, map, phone, LocalBusiness structured data, Finnish section labels, legal pages, and a real multi-page site model.

The honest product is therefore:

`phone/email -> structured intake -> generated SiteData -> automatic Pageforge draft -> human polish -> prospect preview -> acceptance/payment -> automated domain/email/hosting provisioning -> managed updates`

An Opus-class agent is useful around the deterministic renderer, not in place of it. Use an LLM to turn messy Finnish phone notes into draft copy, propose a content hierarchy, translate or rewrite, and flag missing facts. Keep publishing, billing, domain spelling, DNS, mailbox provisioning, exports, and renewals deterministic and auditable.

## Immediate issue separate from the product decision: mikoshi.fi TLS

`mikoshi.fi` needs an immediate TLS repair. A probe on 2026-07-15 with:

```sh
openssl s_client -connect mikoshi.fi:443 -servername mikoshi.fi -showcerts -verify_return_error </dev/null
```

returned `verify error:num=20:unable to get local issuer certificate` and `Verify return code: 20`. The server sent only a leaf for `CN = mikoshi.fi`; that leaf was issued by a private-looking Fortinet CA named `FG4H0FT923900061`, and no issuer certificate followed it. This produces `CERT_AUTHORITY_INVALID` in public browsers.

Quick fix: configure the actual internet-facing TLS terminator to use a publicly trusted certificate and serve its complete chain, normally the provider's `fullchain.pem`, not only the leaf. If a FortiGate is terminating TLS, replace the private appliance-issued leaf with a public ACME certificate or correctly import the public leaf plus intermediates. Re-test with `openssl s_client`, SSL Labs, Chrome, Safari, and Firefox. This is independent of whether Pageforge is adopted.

## Audit scope and evidence standard

This analysis is based on the current repository, not the README alone. I reviewed `README.md`, `wrangler.toml`, all files under `src/`, `scripts/`, and `test/`, including every theme pack and fixture. `npm test` passes all 175 tests in 12 files, and `npm run typecheck` passes.

One documentation mismatch matters: the README still says the Worker serves static assets only and has no server code (`README.md:3-14`), but the actual deployment has `main = "src/worker/index.ts"`, a KV binding, and API-first routing for `/api/*` and `/s/*` (`wrangler.toml:1-19`). The code, not that stale sentence, is used below.

## 1. Capability map

### What Pageforge actually is

- Generation model: `renderSite(data, theme, opts)` is a pure composition of `SiteData` and a `ThemePack` into complete HTML and CSS. It has no clock, randomness, model call, database lookup, or copy generation (`src/engine/render.ts:157-253`). The same input is byte-identical, including ZIP timestamps (`src/engine/bundle.ts:8-40`; `test/render.test.ts:27-33`; `test/zip.test.ts:59-65`).
- Content model: one `SiteData` object contains a name, language, tagline, one hero photo, links, footer note, style metadata, and an ordered list of six section variants: about, projects, hobbies, contact, custom text, and gallery (`src/engine/types.ts:18-89`). It is a one-page model.
- Theming: `ThemePack` is data plus structural CSS, palettes, system font stacks, one of four layout labels, photo shape, and natural content width (`src/engine/types.ts:91-121`). The registry contains 15 themes and mood categories (`src/themes/index.ts:18-45`). User overrides cover palettes, accent, font, width, text scale, surfaces, corners, shadows, density, heading style, hero alignment, photo shape/size, backgrounds, dark mode, and a custom palette (`src/app/steps/customize.ts:45-530`). Contrast is guarded in `effectivePalette`, `fitAccentFor`, and the palette test suite (`src/engine/render.ts:30-68`; `src/engine/color.ts:38-75`; `test/contrast.test.ts:24-42`).
- Templates: `STARTERS` has personal, link hub, event, small business, and club placeholder data. The business starter includes services, an hours/area custom section, and contact details (`src/app/starters.ts:17-147`, especially `src/app/starters.ts:85-123`). These are fixed content skeletons, not generated customer drafts.
- Preview: the wizard renders the actual generated document into a sandboxed `srcdoc` iframe, with inlined CSS and locally embedded images (`src/app/preview.ts:7-35`). The UI offers live, phone-width, and full-screen preview (`src/app/main.ts:143-181`; `src/static/index.html:49-65`).
- Export: `buildSiteFiles` produces `index.html`, `style.css`, `README.md`, `site.json`, favicon, hero photo, and gallery assets; `buildZip` creates a deterministic archive (`src/engine/bundle.ts:19-40`). `site.json` can be loaded from a JSON file or from a prior ZIP (`src/app/steps/content.ts:211-246`). The included README explains generic host deployment (`src/engine/readme.ts:5-58`).
- Hosting/publish path: a beta UI can publish `SiteData` and an OG image to `/api/publish`; the Worker validates and re-renders rather than accepting arbitrary HTML (`src/app/publish.ts:34-144`; `src/worker/index.ts:6-19`, `src/worker/index.ts:76-190`). Pages are stored in KV as `site:<slug>` and served at `/s/<slug>/` with five-minute cache headers (`src/worker/index.ts:41-47`, `src/worker/index.ts:195-230`). An edit key is generated, only its SHA-256 hash is stored, and the clear key remains in browser local storage (`src/app/publish.ts:8-31`; `src/worker/index.ts:124-190`).
- Publish is not an available production product: it is disabled in both client code and Wrangler configuration (`src/app/config.ts:1-18`; `wrangler.toml:9-10`). The Download step presents it as coming later unless an operator sets the local beta override (`src/app/steps/download.ts:73-90`).
- Existing multiple-page support: one browser can keep multiple independent draft records and switch, create, or delete them (`src/app/state.ts:11-24`, `src/app/state.ts:143-174`; `src/app/steps/content.ts:153-200`). Each record still generates exactly one `index.html`; this is multiple one-page drafts, not a multi-page website.
- Existing multi-tenant support: KV can hold many public slugs, which is a minimal shared-hosting primitive. It is not service tenancy. There are no customers, users, roles, prospect records, tenant isolation policy, operator recovery, billing links, domain mappings, mailbox records, audit log, version history, or per-tenant lifecycle. The only ownership mechanism is a bearer edit key (`src/worker/index.ts:41-47`, `src/worker/index.ts:124-190`).

### Mikoshi flow steps

| Flow step | Status | What Pageforge already does | Exact gap |
| --- | --- | --- | --- |
| 1. Customer explains the business by phone or short email | Partial | The browser wizard edits `SiteData`, supports Finnish as the HTML language, accepts photos, links, generic sections, the business starter, and autosaves locally (`src/app/steps/content.ts:32-151`; `src/app/starters.ts:85-123`; `src/app/state.ts:129-140`). | It is a self-service personal-page form, not an operator intake. There is no phone transcript ingestion, email parser, business ID, address, phone, opening-hours structure, service-area structure, map coordinates, domain candidates, brand asset checklist, consent, or missing-information validation. `lang: fi` only changes `<html lang>`; built-in headings such as "About" and "Get in touch" remain English (`src/engine/render.ts:229-230`; `src/engine/sections/blocks.ts:35-70`). |
| 2. Within days, customer gets a finished draft live in a browser | Partial | The live iframe is the real deterministic output (`previewHtml`), and `encodeShare` makes a no-upload preview URL by compressing `SiteData` into the URL fragment (`src/app/preview.ts:11-27`; `src/app/share.ts:7-43`). The disabled publish beta can create a stable `/s/<slug>/` URL with images and OG metadata (`src/worker/index.ts:124-230`). | The share link deliberately strips the hero photo, carries all text in the URL, has no prospect record, expiry, access control, approval state, or version (`src/app/share.ts:25-39`). The hosted route is disabled, public, slug-guessable, not marked `noindex`, and has no staging-to-production promotion. No component turns intake facts into finished Finnish copy or chooses and polishes a design. |
| 3. Publish on the customer's own `.fi` domain | Missing around a reusable renderer | The hosted renderer already accepts `baseUrl`, so canonical and OG URLs can be correct once requests arrive on a custom host (`src/engine/render.ts:153-168`, `src/engine/render.ts:201-219`). Wrangler proves one custom domain can point at the Worker (`wrangler.toml:5-7`). The ZIP can be deployed to any host. | No `.fi` availability/registration/renewal, registrant-holder workflow, registrar integration, nameserver/DNS management, custom-hostname API call, hostname-to-site lookup, apex/`www` redirect, certificate status polling, or publish-at-root path exists. Current serving only recognizes `/s/<slug>` on the Pageforge host (`src/worker/index.ts:267-281`). |

### Mikoshi deliverables

| Deliverable | Status | Pageforge evidence | Product gap and consequence |
| --- | --- | --- | --- |
| Custom `.fi` domain, registration and annual renewal included | Missing | Generic ZIP README says customers may buy a domain and connect it themselves (`src/engine/readme.ts:48-52`). | There is no registrar or renewal code and no domain entity. This is business/legal plumbing, not generation. The customer must be the actual holder, renewal must be monitored, and loss/transfer paths must be explicit. |
| Mobile-first design | Mostly present, with QA gaps | Base CSS uses fluid type, wrapping, responsive galleries, and width variables (`src/engine/css.ts:21-147`). Theme CSS is responsive; Atelier explicitly collapses its split layout on small screens (`src/themes/atelier/theme.ts:54-66`). The app previews at phone width (`src/app/main.ts:174-181`). | There is no automated browser matrix, Lighthouse budget, screenshot regression, Core Web Vitals monitoring, or business-site accessibility review. Palette contrast tests are strong but do not prove whole-page WCAG conformance (`test/contrast.test.ts:24-42`). Call this "mostly", not complete. |
| Business hours | Partial | The business starter encodes hours as unstructured text in a custom section (`src/app/starters.ts:112-116`). `renderCustom` renders it safely (`src/engine/sections/blocks.ts:82-86`). | No weekday schema, split hours, exceptions/holidays, `openingHoursSpecification`, or operator validation. Text works visually, but cannot drive structured SEO or update automation. |
| Services | Partial to good for a simple one-pager | The `projects` section has a custom title and items with name, description, and optional URL; the business starter uses it as "What we do" (`src/engine/types.ts:20-24`; `src/app/starters.ts:102-111`; `src/engine/sections/blocks.ts:40-52`). | Naming and editor copy are portfolio-oriented. No price, duration, category, featured service, booking CTA, or service schema. It is adequate after a business-specific relabel and schema extension. |
| Location map | Missing, with a link-only workaround | Links accept safe HTTP/HTTPS URLs, so a "Directions" link can point to Google Maps (`src/engine/escape.ts:13-34`; `src/engine/links.ts:79-97`). | No address/location type, coordinates, map renderer/embed, map provider choice, consent/privacy mode, directions CTA, or LocalBusiness address schema. Custom text can display an address but is not a map. |
| Company email address such as `info@firma.fi` | Display only; provisioning missing | Contact sections and general links render obfuscated `mailto:` controls (`src/engine/sections/blocks.ts:60-70`; `src/engine/links.ts:49-76`). Tests verify the full address is absent from source and DOM attributes (`test/security-dom.test.ts:31-42`). | Pageforge can display a mailbox after it exists. It cannot buy/provision the mailbox, set MX/SPF/DKIM/DMARC, create credentials, migrate mail, support clients, reset passwords, suspend abuse, or hand ownership to the customer. |
| Fast ad-free hosting | Technically partial; product missing | Static HTML/CSS and image assets are a good fit for Cloudflare edge delivery. The Worker beta serves generated assets and caches them for 300 seconds (`src/worker/index.ts:195-230`). There is no tracking in generated output, and only a tiny trusted email activation script is conditionally added (`src/engine/render.ts:193-199`). | Hosting is disabled and lacks custom domains, SLA, monitoring, tenant records, backup/versioning, incident response, and abuse handling. Every generated footer always contains a Pageforge credit, and hosted pages add a report link (`src/engine/sections/footer.ts:4-14`), so a white-label/ad-free policy needs an explicit service-brand option. |
| Monthly updates included | Partial editing mechanics only | A local draft autosaves, has in-session undo/redo, can be re-imported from `site.json`, and a known edit key can overwrite the same hosted slug (`src/app/main.ts:35-115`; `src/app/steps/content.ts:211-246`; `src/app/publish.ts:74-136`). | No customer request channel, entitlement, SLA, approval, diff, durable versions, rollback, operator assignment, update quota policy, notification, or audit trail. Undo history is session memory, not a published revision system. |
| No lock-in, customer owns domain, site exportable | Export is strong; ownership process is missing | ZIP contains all required static site files plus the editable source data, and no runtime dependency on Pageforge (`src/engine/bundle.ts:19-37`; `test/zip.test.ts:11-65`). The generated README explicitly supports generic hosts (`src/engine/readme.ts:20-40`). | A hosted customer cannot fetch an export from the server. Losing the browser/edit key means no recovery path. There is no domain-holder record, registrar transfer-code flow, DNS handoff, mailbox export/migration assistance, or contractual exit checklist. Also, a site is one HTML page, so "exportable" must not imply a richer CMS or multi-page project. |

### Other business-site limitations that affect the promise

- Finnish localization is incomplete. `lang: "fi"` is supported, but renderer-owned headings are English (`src/engine/sections/blocks.ts:35-70`) and the generator UI is explicitly English-only (`src/app/steps/content.ts:57-80`). A Mikoshi product needs Finnish default copy and possibly Swedish.
- SEO is basic. The renderer emits title, description, OG title/description/type, canonical, and hosted OG image (`src/engine/render.ts:201-241`). It does not generate LocalBusiness JSON-LD, address/hours/service schema, customer sitemap/robots files, social metadata completeness, or local-search verification workflows.
- The output is one page. `buildSiteFiles` always writes one `index.html` and no route tree (`src/engine/bundle.ts:19-37`). Privacy, accessibility, terms, service-detail, or campaign pages would require a real multi-page schema and renderer.
- Content is plain text, not Markdown or controlled rich text (`src/engine/escape.ts:49-58`). That is safe and sufficient for a basic one-pager, but it limits lists, emphasis, price tables, testimonials, and structured calls to action.
- Photos are locally cropped/resized and galleries are capped at six (`src/app/photo.ts:7-28`; `src/app/steps/content.ts:27-28`, `src/app/steps/content.ts:350-387`). This is useful, but there is no business asset library, attribution/license record, alt-text editor for gallery images, focal point per breakpoint, or image optimization pipeline beyond JPEG re-encoding.

## 2. The real gaps to productize a repeatable service

### Proposed control-plane model

The current `SiteData` should remain the render input, but it cannot also be the service database. Add a durable control plane, preferably D1 for relational lifecycle state and R2 for source photos/exports, while keeping rendered sites reproducible.

Minimum durable records:

- `Prospect`: contact, channel, consent, status, assigned operator.
- `BusinessProfile`: legal/display name, Business ID, phone, email, address, map coordinates, services, hours, service area, languages, social links, approved factual claims.
- `DraftVersion`: immutable `SiteData`, asset references, generator version, AI provenance, author, timestamp, preview token, approval state.
- `Site`: tenant ID, production version, preview version, hostnames, publication state.
- `Domain`: requested spelling, holder data, registrar ID, expiry, auto-renew state, nameservers, transfer state.
- `Mailbox`: provider ID, address, provisioning state, DNS verification state, recovery owner. Never store a mailbox password in D1.
- `Order` and `Subscription`: Stripe customer/session/subscription/invoice IDs, VAT treatment, entitlement and dunning state.
- `UpdateRequest`: request text/assets, scope decision, draft, approval, publish timestamp.
- `AuditEvent`: every state transition and external API idempotency key.

KV can continue to cache current rendered `SiteData` by tenant/hostname, but it should not be the source of truth for orders, domains, billing, or versions. The repository currently has only `SITES` KV and no D1 or R2 binding (`wrangler.toml:12-19`).

### Gap-by-gap implementation and human boundary

| Gap | Concrete implementation in or around Pageforge | Automatable? | Human or Opus role |
| --- | --- | --- | --- |
| Structured business intake | Build a Finnish operator/customer intake backed by `BusinessProfile`. Require business name and ID, contact permission, phone, address/service area, hours, services, differentiators, desired domain spellings, photos/logo rights, social links, mailbox recipient, and legal acceptance. Allow phone transcript or pasted email as source, but show extracted fields for confirmation. | Mostly. Forms, validation, YTJ lookup where licensing permits, required-field checks, and transcript extraction are automatable. | A human must confirm factual claims, domain spelling, identity/authority, photo rights, and any ambiguous phone transcript. An LLM can extract and draft; it must not invent prices, qualifications, opening hours, or service areas. |
| Automated first draft | Add `SiteData v2` business fields and deterministic adapters from approved `BusinessProfile` to section order, CTAs, LocalBusiness schema, and 2-4 curated business theme presets. An LLM may produce constrained Finnish copy JSON with citations back to intake facts; validate it before rendering. | Layout, theme preset, schema, and rendering are fully automatable. Copy is assistive automation. | Use a strong model for messy notes, natural Finnish copy, tone, translation, and exception cases. Human reviews headline, factual accuracy, photos, map pin, mobile layout, and brand fit before sending. Opus is unnecessary for ordinary rendering or deployment. |
| "View first" prospect staging | Create `draft-<opaque>.preview.mikoshi.fi` or signed `/p/<token>` URLs from immutable `DraftVersion`. Include photos, `noindex,nofollow`, expiry/revocation, view/approval status, an approval/comment action, and a visible "draft" banner outside the customer page. Promote the exact approved version to production. | Yes. Reuse `renderSite`, `previewHtml`, `renderOgCard`, Worker routing, and image collection. Replace fragment sharing for commercial previews. | Human polish occurs before release. A human resolves customer comments; promotion itself should be deterministic. |
| `.fi` registration and annual renewal | Contract-test a registrar/reseller, then integrate availability, create, renew, transfer, contact update, nameserver, DNSSEC, expiry, and webhook/polling flows. Openprovider is the leading first spike: its official `.fi` page documents REST registration and `.fi` holder requirements, and its reseller API covers domain lifecycle. Traficom says `.fi` names are obtained through registrars and that registrars perform renewals. The actual holder must be the customer, not Mikoshi. Sources: [Traficom - how to get a .fi domain](https://traficom.fi/en/fi-domains/applying-and-using-fi-domains/how-get-fi-domain-name), [Traficom - holder rights](https://traficom.fi/en/fi-domains/applying-and-using-fi-domains/domain-name-holders-rights), [Openprovider `.fi` requirements](https://support.openprovider.eu/hc/en-us/articles/360000754788--fi), [Openprovider reseller API](https://developers.openprovider.com/). | API operations, renewal reminders, auto-renew, DNS setup, and status reconciliation are automatable after vendor access. | Customer must approve the exact name and holder data. Human handles protected-name risk, failed validation, transfers, disputes, registrant corrections, and vendor exceptions. Becoming a registrar directly is a separate regulated business with statutory and information-security obligations, not an MVP shortcut ([Traficom registration as registrar](https://traficom.fi/en/fi-domains/domain-name-registrars/registration-registrar)). |
| Business email provisioning | Use a mailbox provider, not a forwarding-only hack. The most coherent first vendor spike is Openprovider Business Email because it is white-label, reseller-oriented, offers hosted mailboxes with webmail/POP3/IMAP and aliases, and advertises API/WHMCS automation. Provision `info@domain.fi`, publish MX/SPF/DKIM/DMARC, verify DNS, and provide a secure activation/reset flow. Source: [Openprovider Business Email](https://www.openprovider.com/products/business-email-solution). Keep Microsoft 365 CSP or Google Workspace reseller as a premium option if customers need calendar/office suites. | Domain, mailbox, alias, and DNS provisioning can be automated. Password setup should be customer-initiated through a short-lived provider/reset link. | Human support remains for mail-client setup, migration, deliverability, compromised accounts, and explaining retention. At 19€/month, provider cost and support time must be measured before promising unlimited support. |
| Per-customer hosting and custom-domain attach | Use one multi-tenant Worker, a hostname-to-site mapping, and Cloudflare for SaaS Custom Hostnames for customer apex/`www` TLS. Create hostnames through the API, write registrar DNS, poll both hostname and SSL status to `active`, and route the request host to the approved tenant/version. Cloudflare documents the create/list/edit/delete API and automatic certificate lifecycle. Sources: [Cloudflare custom hostname API](https://developers.cloudflare.com/api/resources/custom_hostnames), [custom hostname readiness](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/common-api-calls/), [Worker hostname routing](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/hostname-routing/). | Yes, including DNS and TLS polling, if registrar and Cloudflare API access are in place. | Human handles CAA conflicts, pre-existing DNS/mail records, domain already on another CDN, apex edge cases, and outages. Never declare publication successful until HTTP, hostname, and certificate checks pass. |
| Monthly update workflow | Add authenticated/signed update requests, operator queue, entitlement/SLA, immutable versions, preview diff, customer approval, one-click promote, rollback, and notifications. Preserve the current production version until approval. Store original assets in R2 and versioned `SiteData` in D1. | Intake, diff, preview, deploy, rollback, status mail, and simple structured changes are automatable. | Human reviews all public copy and images. LLMs are useful for translating vague requests into proposed structured changes, but should never publish directly. Define what "monthly updates included" means: reasonable text/photo changes, not redesigns or new functionality. |
| Billing: 249€ plus 19€/month | Use Stripe Checkout in `subscription` mode with a mixed cart: a one-time 249€ setup price and recurring 19€/month price. Stripe explicitly supports recurring and one-time line items together, with the one-time item on the first invoice. Drive provisioning from verified webhooks, not the browser success redirect. Handle failed payments, cancellations, credits, and customer portal access. Sources: [Stripe mixed-cart Checkout](https://docs.stripe.com/payments/checkout/how-checkout-works), [Stripe subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks). | Checkout, subscription, invoices, retry/dunning events, and entitlements are automatable. | Human/accountant must decide whether advertised prices include VAT, configure products/tax codes, approve invoice text and bookkeeping export, and handle refunds/disputes. For a Finnish VAT-registered seller, general services normally use 25.5% VAT; verify the exact treatment with an accountant ([Vero VAT rates](https://www.vero.fi/en/businesses-and-corporations/taxes-and-charges/vat/rates-of-vat/)). Finnish business buyers must receive compliant invoices ([Vero invoice requirements](https://www.vero.fi/en/detailed-guidance/guidance/48090/vat-invoice-requirements/)). Stripe Tax can calculate EU VAT, but it does not file the Finnish return by itself ([Stripe EU tax](https://docs.stripe.com/tax/supported-countries/european-union)). |
| Customer ownership and export guarantee | Register the domain in the customer's legal name with their contact email; give them contract language covering renewal, transfer, suspension, and exit. Add an authenticated "export current site" endpoint that reconstructs the existing ZIP from the approved version and assets. On exit, provide ZIP, `site.json`, domain transfer authorization/process, DNS zone export, mailbox migration window, and written deletion schedule. Escrow/recovery must work if the operator loses a browser. | ZIP generation, scheduled export snapshots, holder-data checks, and an offboarding checklist can be automated. | Human verifies transfer recipient, resolves unpaid balance versus non-negotiable holder rights, coordinates mailbox migration, and signs off deletion. Legal terms and privacy/DPA work require counsel, not an LLM. |

### Business and legal plumbing is not a Pageforge feature

The service also needs terms, privacy notice, processor/subprocessor records, retention policy, photo/content warranty, acceptable-use policy, abuse mailbox, incident handling, domain-holder authorization, update scope, cancellation and refund rules, service continuity, and bookkeeping. These are operational requirements even if every website is static.

Price presentation needs an explicit decision. If 249€ and 19€ are VAT-inclusive at 25.5%, the approximate net amounts are 198.41€ plus 50.59€ VAT and 15.14€ plus 3.86€ VAT. If they are net B2B prices, marketing and Checkout must clearly say "plus VAT". The margin model must include annual `.fi` renewal, mailbox cost, Stripe fees, Cloudflare plan/usage, support, failed payments, update labor, and offboarding. Do not automate the promise before these unit economics work.

## 3. Automation verdict

### Fully automated replacement: no

The current Pageforge cannot replace an Opus-per-customer process end to end. It has no customer lifecycle or external provisioning, and its deterministic engine cannot infer a trustworthy business story from a phone call. A fully hands-off service would create unacceptable risks around incorrect claims, wrong domains, bad map pins, photo rights, mailbox credentials, VAT, and public publication.

### Human-supervised assembly line: yes

Pageforge is a strong foundation for a supervised service because it makes the final website artifact deterministic, safe, cheap to reproduce, and portable. Once the intake is normalized, most customers in the stated target segments can fit a curated one-page business template.

Recommended division of labor:

| Work | Best tool |
| --- | --- |
| Parse a short email or transcript into candidate structured facts | LLM with a strict schema and source spans |
| Draft natural Finnish headline, service descriptions, CTA, and tone variants | LLM, with human review |
| Detect missing/contradictory facts and prepare follow-up questions | LLM plus deterministic validation |
| Choose from curated sector presets | Deterministic rules first; LLM suggestion is optional |
| Render HTML/CSS, escape content, apply theme and contrast rules | Pageforge `renderSite` |
| Produce preview, ZIP, OG image, sitemap/schema, and version hash | Deterministic Pageforge pipeline |
| Confirm business facts, domain spelling, legal authority, map location, and photo rights | Human/customer |
| Visual polish and assess whether the preset actually suits the business | Human designer/operator; Opus vision can assist |
| Charge, issue billing events, register/renew domain, provision DNS/mail, attach hostname, poll TLS | Deterministic APIs and state machine |
| Publish or roll back an approved version | Deterministic state transition, never an autonomous model action |
| Interpret vague monthly update requests | LLM drafts the change; human approves and publishes |
| Handle disputes, mail migration, domain transfer, VAT exceptions, abuse, and outages | Human specialist |

For routine customers, Opus should move from "build the whole site by hand" to "content and design copilot for exceptions." A smaller, cheaper model may be sufficient for schema extraction and first-pass Finnish copy after evaluation. Reserve Opus for low-quality transcripts, nuanced rewriting, unusual sectors, multilingual sites, and visual critique. The deterministic Pageforge engine should remain the system that creates the shippable artifact.

### Practical target operating model

1. Operator records a call or pastes an email with consent.
2. Extraction creates a `BusinessProfile` and highlights unknowns.
3. Customer/operator confirms facts and the exact domain spelling.
4. A composer generates 2-3 Pageforge draft variants from curated presets.
5. Human selects, edits, checks mobile/desktop, verifies map/contact/hours, and releases one private preview.
6. Customer comments or approves.
7. Stripe collects 249€ plus the first 19€ subscription invoice with correct VAT treatment.
8. A provisioning state machine registers the customer-owned `.fi`, configures Cloudflare and mail DNS, provisions the mailbox, waits for TLS/mail verification, and publishes the approved immutable version.
9. Monthly requests repeat the draft-preview-approve-promote cycle with rollback.

This can reduce hands-on site production from a bespoke agent session to a short review and exception-handling task. It cannot eliminate customer communication or operational responsibility, and that is compatible with Mikoshi's trust-based promise.

## 4. Build recommendation

### Decision

Go for a staged productization, with two explicit constraints:

- Go only for a curated one-page small-business offer in the first release. Do not promise arbitrary websites or rich multi-page CMS behavior.
- Treat full autonomy as a no-go. The release gate is a measured supervised workflow with reliable offboarding, not an impressive unconstrained demo.

### Ordered epics

| Order | Epic | Main output | Reuse from Pageforge/mtclab | Net-new work | Data/integration gate |
| --- | --- | --- | --- | --- | --- |
| 1 | Commercial, legal, and vendor feasibility spike | Signed-off unit economics, service terms outline, responsibility matrix, vendor sandbox proof, and go/no-go thresholds | Existing Cloudflare account/deploy practice can be investigated, but the repo proves only one Worker, assets, and KV. | Registrar/mail vendor contract, Cloudflare for SaaS plan decision, Stripe Finland account, VAT/accounting design, privacy/DPA/subprocessor review, abuse process. | Openprovider or alternative production and sandbox access; confirmation of `.fi` registrar-of-record and holder/transfer behavior; mailbox API availability; Stripe live account; accountant sign-off; Cloudflare plan/quotas. Stop if 19€/month cannot cover hard cost and expected support. |
| 2 | Business content model and Finnish renderer | `SiteData v2`, migrations, Finnish/Swedish renderer labels, first-class phone/address/map/hours/services/CTA, LocalBusiness JSON-LD, customer robots/sitemap, business footer/branding policy, and curated sector fixtures | Pure engine, decoders, escaping, section renderer, bundle, themes, contrast logic, fixtures and snapshot test pattern (`src/engine/*`, `src/themes/*`, `test/*`). | New business types/renderers, locale catalog, map component, schema.org, multi-file bundle additions, accessibility and browser tests. | Approved minimum deliverable definition; map provider/privacy choice; Finnish copy review. |
| 3 | Structured intake and assisted draft composer | Finnish intake, transcript/email import, source-linked extraction, missing-field checks, deterministic profile-to-site composer, 2-3 curated variants | Business starter pattern, `decodeSiteData`, import logic, theme registry, preview. | `BusinessProfile`, extraction service, prompt/evaluation set, fact provenance, consent capture, asset checklist, domain candidate confirmation. | Model/API and data-processing approval; representative Finnish test calls/emails; consent policy; quality threshold for extraction and hallucination rate. |
| 4 | Service control plane and operator console | D1-backed prospects/customers/sites/versions/orders/domains/mailboxes/update requests/audit events; operator authentication and role checks; R2 assets/exports | Worker runtime, pure renderer, existing Pageforge editor components and local preview concepts. | D1/R2 bindings and migrations, authenticated admin UI/API, tenant IDs, idempotent jobs, secrets, backups, observability. | Cloudflare account environment and access policy; data retention and operator identity choice; recovery/backup test. D1 and R2 are not present in this repo today. |
| 5 | Private "view first" staging and approval | Stable opaque preview URLs with photos, noindex, expiry/revoke, version pinning, comments/approval, and exact promote target | `previewHtml`, `renderSite`, OG renderer, hosted `serveSite`, image collection, existing `/s/` concept. | Preview tokens, D1 version lookup, R2 assets, noindex headers/meta, approval API, notification, rate limits, abuse controls. | Preview hostname/DNS; email/SMS notification provider decision; security review. |
| 6 | Human polish and launch QA pipeline | Operator checklist and automated checks for facts, links, phone, map, hours, mobile/desktop, accessibility, performance, SEO, and screenshot diffs | Current 175-test suite, contrast guard, phone/fullscreen preview, security escaping tests. | Playwright/browser matrix, Lighthouse budgets, screenshot regression, broken-link checking, spelling/locale checks, approval audit. | Supported browser/device matrix and measurable release thresholds; designated Finnish editorial reviewer. |
| 7 | Stripe order, subscription, VAT, and entitlement state | Mixed-cart Checkout for 249€ plus 19€/month, compliant invoice flow, signed webhooks, customer portal, dunning/cancel state, provisioning entitlement | Worker can host webhook endpoints, but no billing code is reusable. | Stripe integration, idempotency, tax/customer fields, invoices/receipts, accounting export, refund/credit and failed-payment operations. | Stripe live credentials; price inclusion/exclusion decision; VAT registration and accountant-approved configuration; terms/cancellation text. |
| 8 | Domain, DNS, email, and production-host provisioning | `.fi` availability/register/renew/transfer, customer holder records, Cloudflare DNS/custom hostnames/TLS, `info@` mailbox, SPF/DKIM/DMARC, root/`www`, health checks, and deterministic publish state machine | `renderSite` hosted options, current Worker, `renderOgCard`, KV cache, Wrangler custom-domain precedent, delete/update concepts. | Openprovider adapter, Cloudflare API adapter, host-to-tenant routing, job/retry/reconciliation, credentials handoff, renewal monitor, mail verification, incident tooling. | Production registrar/mail API, prefunded balance/credit and price quote; Cloudflare for SaaS zone/plan; API tokens; tested `.fi` registration and transfer in customer name; email deliverability test. |
| 9 | Monthly updates, export, ownership, and offboarding | Signed update intake, versioned draft/approval/promote/rollback, entitlement tracking, downloadable current ZIP, scheduled export snapshot, domain/DNS/mail transfer checklist, deletion log, service dashboard | ZIP/site.json format, import/edit UI, renderer determinism, publish update semantics. | Durable versions/diffs, customer recovery/auth, update queue, notifications, export endpoint, registrar transfer and mailbox migration workflows, SLA metrics. | Contract-approved update scope and exit policy; provider transfer/export tests; retention/deletion policy; support staffing and escalation rota. |

### MVP cut and sequencing advice

Do not wait for every integration to validate the production workflow. After Epics 1-6, run a 5-10 customer supervised pilot where domain/mail provisioning is performed manually through the selected vendor control panels but every action is recorded in the control plane. This tests intake quality, polish time, revision volume, monthly support cost, and whether the one-page format satisfies the target segments. It is still a repeatable assembly line, even before the vendor adapters are automated.

Automate Epics 7-9 only after the pilot produces stable states and exception lists. Automating a bad or underspecified manual process will make domain, email, billing, and ownership mistakes faster.

### What is reusable versus net-new

High-value reuse:

- Pure deterministic `renderSite` engine and escaping boundary.
- Fifteen theme packs, palettes, fonts, layout CSS, and override system.
- Business starter as an initial content skeleton, not as the final schema.
- Live preview, phone/fullscreen modes, photo crop/resizing, gallery packaging, OG card, and QR generation.
- ZIP plus `site.json` portability.
- Worker-hosted re-rendering model that accepts data rather than arbitrary HTML.
- Existing security, determinism, contrast, import, share, and ZIP test patterns.

Partial reuse requiring refactor:

- KV hosted publish can become the current-version cache, but not the source of truth.
- Edit-key ownership is acceptable for a hobby beta, not customer recovery or operator access.
- `/s/<slug>` is useful for a preview prototype, but production must route by hostname and serve at `/`.
- Existing generic sections can render a first pilot, but business fields and localization need first-class support.
- Existing multiple local drafts can inform an editor switcher, but it is not tenant storage.

Net-new:

- D1/R2 control plane, authentication, customer/operator roles, audit and versioning.
- Intake extraction/composition and its evaluation harness.
- Private staging, approval/comments, promotion and rollback.
- `.fi` registrar, DNS, Cloudflare for SaaS, and email-provider adapters.
- Stripe/VAT/invoice/accounting state.
- Renewal, dunning, monitoring, abuse, support, update, export and offboarding operations.
- Legal and commercial framework.

Cloudflare Pages is mentioned in Pageforge's generic deployment instructions, but this repository does not deploy customer sites as Pages projects. The actual current infrastructure is a Worker with static assets plus KV (`wrangler.toml:1-19`). A single multi-tenant Worker with D1/R2 and Cloudflare for SaaS is a cleaner fit than creating a Pages project per customer.

## Final answer

Pageforge can realistically replace the repetitive build mechanics of the manual Opus-per-customer plan. It cannot replace customer discovery, factual/legal approval, visual judgment, or the domain/email/payment/VAT operations that make Mikoshi a service rather than a site generator.

The best product is a supervised assembly line. Let a model translate messy human input into a constrained proposal. Let a human approve the story and design. Let Pageforge produce the exact artifact. Let deterministic APIs provision and maintain the business services. That split is cheaper, safer, easier to audit, and preserves Mikoshi's strongest promise: the customer sees a real finished site before paying and can leave with their domain and files later.
