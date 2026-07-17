# Mikoshi staging build - target-verification audit (2026-07-17)

Requirement -> evidence map against the SOURCE texts (Gwasagir/mikoshi#1 epic
body, mtclab/pageforge epics #32-#40, docs/MIKOSHI_FIT.md, this repo's
docs/MIKOSHI_BUILD_PLAN.md), re-read at audit time - not from session memory.
Evidence = code path + test suite + staging-box smoke (per-slice smokes and the
27-step full-journey E2E, all PASS on dev 043d888, 295 unit tests green).

Statuses: **BUILT** (evidence in code+test+smoke) / **PARTIAL** /
**GATED** (deliberately not buildable now - see gate register in
MIKOSHI_BUILD_PLAN.md) / **NOT BUILT** (honest gap).

## Gwasagir/mikoshi#1 (customer-update architecture)

| Requirement (epic text) | Status | Evidence |
|---|---|---|
| One validated mutation API over typed site data; nothing edits prod directly | BUILT | biz.ts + validate.ts; every write staged via proposals; E2E 9a-9c |
| Email -> AI parser channel: mail creates structured update request, reply w/ preview + approve | PARTIAL | Ingress + queue + MCP loop BUILT (update-channels.ts, E2E step 9); AI parsing lives OUTSIDE by design; **outbound reply mail NOT BUILT** (no mail provider - gate) |
| Customer panel: magic link, capability-driven fields only | BUILT | panel.ts; forged fields provably ignored (E2E 10, unit tests) |
| MCP: read open, mutate = staged diff only, publish absent | BUILT | mcp.ts 5 tools, no approve/publish/rollback; smoke asserts tool list |
| Typed fields, field edit cannot break design | BUILT | validateSiteData + deterministic renderSite; panel replaces whole sections only |
| AI proposes, never publishes | BUILT | tool surface + publish gate; approval-key/operator only |
| Versioned publishes, 1-click rollback, change log = billing evidence | BUILT | snapshot n = content of version n; rollback + audit_events ledger; publish-exact-version |
| Claim-flow onboarding ("Ota tama sivu kayttoon" on outbound drafts) | PARTIAL | All machinery exists (tokened previews, orders, entitlement-gated publish); **the claim BUTTON/flow page itself NOT BUILT** - it is the S8/#36+#38 stitch, needs preview hostname + Stripe gates anyway |
| Open Q1 engine replaces Astro-per-customer | OPEN | awaiting Niko (no reply on #1) |
| Open Q2 where API lives | ANSWERED de facto | pageforge worker + D1/R2 (this build) |
| Open Q3 capability set v1 | ANSWERED provisionally | hours/services/notice editable; gallery/location/contact render-only |
| Open Q4 naming | OPEN | code stays pageforge |
| Open Q5 approval default | ANSWERED provisionally | both paths exist; pilot default = operator console; customer approval-key works |

## pageforge epics

**#32 feasibility/vendor spike - GATED (unchanged).** Nothing here builds it:
unit economics, vendor accounts, Stripe live, VAT sign-off remain owner/Niko
actions. STOP-condition untouched.

**#33 content model & FI renderer - BUILT except:** fi/en/sv labels, business
sections, LocalBusiness JSON-LD (schema.org day enums), per-customer robots/
sitemap (flag-gated), branding policy (hideBranding), sector fixtures, call
CTA. **Map = link-only** (mapUrl anchor; embedded map component NOT BUILT -
the epic's own gate "map provider/privacy choice" is undecided). "SiteData v2"
deliberately materialized as BusinessProfile + composer (documented deviation).

**#34 intake & composer - BUILT except:** typed BusinessProfile w/ provenance
+ consent, contradiction checks, deterministic 2-3 variant composer (structure
from vertical, aesthetics never - owner hard deck). **LLM extraction service
(transcript/email -> profile w/ source spans) NOT BUILT, not even as
interface** - gate register says interface-only was intended; recorded as the
one place the build under-delivers vs its own plan. Asset/rights = consent
fields only; domain confirmation happens at provisioning start.

**#35 control plane & console - BUILT:** all durable records in D1 (prospect,
profile, versions, site, order, update request, audit, + tokens/QA/
provisioning/deletion ledger), R2 photos (per-tenant since 0009), operator
console. **No roles** (single operator, documented), Domain/Mailbox exist as
provisioning-run records not standalone entities, no backups/observability
beyond audit trail (gate-adjacent, prod concern).

**#36 view-first staging & approval - BUILT except:** signed revocable
expiring preview tokens, version pinning, comments, draft banner, promote-
exact-version, rate limits. **Notification (sending the link) NOT BUILT** (no
mail provider - epic's own gate). Preview hostname = gate.

**#37 QA pipeline - PARTIAL by design:** 13 deterministic checks + persisted
runs + FI launch checklist + publish gate w/ audited override. Playwright/
Lighthouse/screenshot-diff/browser-matrix NOT BUILT (epic gate: matrix +
thresholds undecided; Actions-budget mandate; local-scripts path also not
written). Spelling/locale checks NOT BUILT.

**#38 orders & entitlement - BUILT as adapter:** order/billing records, mock
provider end-to-end, real Stripe Checkout shape (subscription mode + one-time
item, verified webhook signatures) behind env keys, entitlement gates customer
publish, dunning statuses modeled. **NOT BUILT: customer portal, invoices/
receipts, accounting export, refunds** - all sit behind the Stripe-account/VAT
gates.

**#39 provisioning - BUILT as manual-mode:** 7-step evidence-required state
machine, go_live fused with QA gate + entitlement ("never live until checks
pass" honored: http_check + gate precede go_live), renewal model. Real
Openprovider/CF-for-SaaS/mail adapters = named TODO gates. No cron scheduler
in staging (renewal view only).

**#40 updates/export/offboarding - BUILT except:** update queue (3 channels),
versioned approve/promote/rollback, authenticated export ZIP (R2 photos
materialized, no branding), transfer checklist, archive/restore + permanent
delete w/ deletion ledger, orders retained. **NOT BUILT: scheduled export
snapshots, notifications, SLA metrics dashboard** (dashboard has counts only).
"Monthly updates included" contract wording = owner/Niko decision, not code.

## Honest gap list (everything above NOT BUILT, in one place)

1. Outbound email (preview links, approve confirmations, panel magic-link
   delivery) - blocked on mail provider + mikoshi.fi DNS gates
2. Claim-flow page (the "Ota tama sivu kayttoon" button stitching preview ->
   pay -> publish) - next build item once Stripe test keys exist
3. LLM extraction interface (#34) - the only under-delivery vs our own plan
4. Embedded map (#33) - link-only until privacy/provider decision
5. Browser-matrix QA (Playwright/Lighthouse/screenshots, spelling) (#37)
6. Stripe customer portal/invoices/refunds/accounting export (#38)
7. Real vendor adapters + renewal cron (#39)
8. Scheduled exports, SLA metrics, notification fan-out (#40)
9. Operator roles, backups/observability (#35)

Accepted risks (documented, deliberate): operator session cookie Path=/ (needed
for /p/ operator access), CI dispatch-only (Actions-budget mandate; deploy
workflow still tests on main).

## Verdict

The staging target - "full app built to staging, fully providing what the
epic planned" - is met for the mikoshi#1 architecture: every safety property
(typed data, staged-only AI, human approval, versioned publish, audit trail)
is implemented, tested, and smoke-proven end-to-end, and the whole supervised
assembly line (discover -> intake -> compose -> approve -> pay(mock) -> QA ->
provision -> live -> update loop -> export/exit) runs on the staging box.
Epics #32-#40 are delivered to the boundary of their own gate registers, with
the nine gaps above named. Item 3 is the only silent shortfall vs plan; items
1-2 are the natural next slices once owner gates open.
