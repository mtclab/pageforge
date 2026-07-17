# Mikoshi build plan - end state and staging slices

Status: **S1-S10 BUILT on `dev` (2026-07-17)** - all ten slices line-reviewed,
box-smoked per slice AND with a full customer-journey E2E run (prospect ->
intake -> compose -> approve -> order/mock-pay -> QA gate -> provisioning ->
go-live -> email/MCP/panel update loop -> export -> archive/restore/delete),
283 tests, migrations 0001-0008. NOT promoted to main; every gate in the
register below still stands. Companion to `docs/MIKOSHI_FIT.md` (gap
analysis), epics #32-#40 (scope), and Gwasagir/mikoshi#1 (customer-update
architecture, agreed strawman). API/console reference: `docs/MUTATION_API.md`.

Versioning invariant (fixed during E2E): snapshot n = content OF version n
(original = version 0); the current version has no snapshot row, and
publishedVersion === currentVersion means serve live data.

Everything here ships to **staging only**: `dev` branch, local wrangler dev with
D1/R2 emulation, every new surface behind `MUTATION_API_ENABLED` +
`OPERATOR_KEY`. Nothing is promoted to `main` (= production deploy) as part of
this build.

## End state (what "fully built" means)

One Worker + one admin app serving the whole mikoshi service loop:

```
discovery (Alt/Hermes, friend's repo)          [external, unchanged]
   │ lead facts
   ▼
BusinessProfile intake ──► deterministic composer ──► 2-3 draft variants
   (operator console)         (no LLM in worker)          (immutable DraftVersions)
                                                              │
                            signed preview URL (noindex, expiry, banner)
                                                              │
                     approval (customer approval key / operator) + comment
                                                              │
        QA gate (deterministic checks + operator checklist) ──┤
                                                              ▼
                                            promote EXACT approved version
                                                              │
        Stripe order/webhook ─► entitlement ─► provisioning state machine
        (test mode in staging)                 (manual-mode adapters, every
                                                step recorded; never live until
                                                http + hostname + cert pass)
                                                              │
                                                              ▼
                                                      published site
                                                              │
   updates: email ingress ─► UpdateRequest queue ◄─ customer panel (magic link)
            MCP tools (propose-only)                capability-driven fields
                        │
                        └─► proposal → preview → approve → promote (same loop)

   exit: authenticated export ZIP + transfer checklist + deletion log
```

Data plane: **D1 is the source of truth** for every durable record
(BusinessProfile, DraftVersion, Site, Domain, Mailbox, Order, UpdateRequest,
AuditEvent). **R2 holds photos and export snapshots.** **KV is a render cache
only.** The pure `renderSite` engine stays deterministic and LLM-free; AI
participates exclusively through MCP propose-only tools and external
extraction services with fact provenance.

## Slice order (each: spec → codex build → Claude line-review + live smoke)

| # | Slice | Epic | Status | Delivers |
|---|-------|------|--------|----------|
| S1 | D1/R2 foundation | #35 | DONE `1bdcb4d` | migrations, entities, biz source-of-truth KV→D1, R2 photos |
| S2 | Operator console | #35 | DONE `455ca92` | /admin auth + sessions, entity views, pipeline states, AuditEvent everywhere |
| S3 | Intake + composer | #34 | DONE `b53fc13`+ | BusinessProfile w/ provenance+consent, contradiction checks, 2-3 deterministic variants |
| S4 | Renderer completion | #33 | DONE `227c1c3` | sv locale, LocalBusiness JSON-LD, call-CTA hero, robots/sitemap, paid-branding policy, sector fixtures |
| S5 | Draft versioning | #36 | DONE `8c8d467` | immutable DraftVersions, signed preview tokens w/ expiry/revoke, comments, promote-exact-version |
| S6 | QA pipeline | #37 | DONE `ce09342` | deterministic checks (facts/links/a11y/size) + launch checklist state machine |
| S7 | Update channels | #40, mikoshi#1 | DONE `cb60334` | email ingress (Email Routing shape), UpdateRequest queue, magic-link customer panel, MCP extensions |
| S8 | Stripe orders | #38 | DONE `e688434` | mixed-cart checkout shape + mock provider, signed webhooks drive state, entitlement, dunning states |
| S9 | Provisioning | #39 | DONE `6adca5d` | publish state machine, vendor adapter interfaces + manual-mode, renewal monitor model |
| S10 | Export/offboarding | #40 | DONE `408f714` | authenticated export ZIP, transfer checklist, deletion log, customer recovery |

Post-slice hardening on `dev`: tel-link seam fix (profile validation +
composer-derived call CTA) and the snapshot-numbering fix `3e77cc7` - both
found by the full-journey E2E, both regression-tested.

Already landed (PR #41): business sections w/ FI localization, KV mutation API
(propose → noindex preview → approve → versioned rollback), propose-only MCP.
S1/S5 rework its storage onto D1 without changing the external contract.

## Honest gate register (not buildable in staging - interfaces + manual-mode only)

| Gate | Blocks | Owner action |
|------|--------|--------------|
| Openprovider (or alt) account + sandbox | #39 real .fi/mailbox adapters | Niko/owner opens account, funds balance |
| Cloudflare for SaaS zone + plan decision | #39 custom hostnames | account decision |
| Stripe FI account + live keys | #38 live billing | Mikoshi Oy Stripe onboarding |
| VAT incl-vs-plus + accountant sign-off | #38 tax config | accountant |
| Preview hostname/DNS + notification provider | #36 public preview URLs | mikoshi.fi zone move to CF (friend's repo TODO) |
| FI editorial reviewer + browser/device matrix | #37 full QA | decision |
| Model/data-processing approval + eval set | #34 LLM extraction | decision; interface ships now |
| Lighthouse/Playwright in CI | #37 | conflicts with Actions-budget rule; local scripts only until owner opts in |
| Unit-economics sign-off | #32 | spike doc exists (MIKOSHI_FIT); go/no-go is Niko+owner |

Deviation from epic #33 wording, deliberate: SiteData stays version 1 with
business extensions (15 themes and the app keep working untouched);
"SiteData v2" materializes as **BusinessProfile** (intake/control-plane
entity, D1) + composer that emits standard SiteData. Renderer contract
unchanged = every existing test and theme keeps guarding the output.

## Working rules for this build

- Root causes, no placeholders; every slice lands with tests and a live
  wrangler-dev smoke of the affected flow.
- All state transitions append AuditEvent rows.
- Nothing the AI can call may publish; approval stays human.
- Secrets never in git or wrangler.toml; `.dev.vars` local only.
- Batched pushes to dev; CI is dispatch-only, prod deploys only from main.
