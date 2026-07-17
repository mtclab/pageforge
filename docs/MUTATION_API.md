# Mikoshi mutation API

The mutation API is a staging-only surface for Finnish small-business card sites. It is closed by default and does not deploy or publish to production custom domains.

## Environment and authentication

Both of these conditions must be true before any `/api/biz/*`, `/api/mcp`, `/api/billing/*`, `/p/*`, `/b/*`, `/img/*`, `/claim/*`, `/panel`, `/admin*`, `/mock-checkout/*`, or `/order/*` route opens:

- `MUTATION_API_ENABLED=true`
- `OPERATOR_KEY` is set

`wrangler.toml` keeps `MUTATION_API_ENABLED="false"`. Never put `OPERATOR_KEY` there. For local staging, set it in `.dev.vars`. Closed routes return 404.

Auth surfaces:

- **Operator**: `Authorization: Bearer <OPERATOR_KEY>` on the API; on the console a stateless HMAC session cookie (login at `/admin/login`, 12h, rotation of `OPERATOR_KEY` revokes all sessions; CSRF token on every mutating form).
- **Approval key**: creating a site returns a per-site approval key once; only its SHA-256 hash is stored. It can read the site, approve/reject proposals, roll back, and publish (gated - see below).
- **Preview tokens**: `/p/*` requires `?t=<token>` (hash-only storage, expiry, revocable, optionally proposal-scoped; auto-issued for 14 days on every proposal) or an operator session. Bare preview URLs 404.
- **Claim access**: `/claim/:siteId?t=<token>` accepts the same site-scoped or proposal-scoped preview tokens (or an operator session). POST forms double-submit the token and are limited to five attempts per site per UTC day.
- **Panel tokens**: `/panel?t=<token>` magic links (30 days, revocable) let the customer submit capability-scoped update proposals. The panel can never approve or publish.

## REST endpoints (main surface)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/biz/sites` | Operator | Create a site; returns id + one-time approval key |
| GET | `/api/biz/sites/:id` | Operator or approval key | Data, version metadata, published pointer, open proposals |
| POST | `/api/biz/sites/:id/proposals` | Operator | Stage a complete validated candidate (returns tokened preview path) |
| POST | `.../proposals/:pid/approve\|reject` | Operator or approval key | Decide a proposal (approve promotes to a new current version) |
| POST | `/api/biz/sites/:id/rollback` | Operator or approval key | Restore version n (original = version 0) |
| POST | `/api/biz/sites/:id/publish` | Operator or approval key | Point `/b/` at exact version n (default: current). Gated: passed QA run for that exact version + full launch checklist; operator may override with audited reason; approval-key publishes additionally require a paid order and cannot override |
| POST | `/api/biz/sites/:id/unpublish` | Operator or approval key | Remove the site from `/b/` and return it to approved state |
| POST | `/api/biz/sites/:id/photos` | Operator | Upload photo (R2, sha256 dedup, 2 MB, jpeg/png/webp) -> `/img/<sha>` |
| POST | `/api/biz/sites/:id/order` | Operator or approval key | Create the 249e + 19e/kk order; returns checkout redirect (mock provider by default) |
| GET | `/api/biz/sites/:id/export` | Operator bearer, approval key, or operator session | ZIP: rendered index.html (no credit/banner), site.json, assets, LUEMINUT.txt |
| POST | `/api/biz/email-ingress` | Operator | Staging simulator for the Email Worker handler |
| POST | `/api/billing/webhook` | Signature | Provider webhooks (HMAC-verified, drives order state) |
| GET | `/p/:id/:pid` | Token or operator session | Proposal preview, draft banner, noindex, comment form |
| POST | `/p/:id/:pid/comments` | Token double-submit | Customer feedback (20/proposal cap) |
| GET | `/claim/:id?t=:token` | Preview token or operator session | Show the 249 € + 19 €/kk claim form, or the reserved state |
| POST | `/claim/:id?t=:token` | Preview token double-submit or operator session | Validate contact/domain details, create the claim and order, and redirect to checkout |
| GET | `/b/:id` | Public (when flag on) | Published pointer for sites in published state; every unpublished or archived site returns 404 |
| GET/POST | `/panel` | Panel token | Capability-scoped customer update form -> staged proposal |

Operator and MCP proposal creation share a limit of 50 per site per UTC day. Customer panel submissions have a separate 20-per-site daily limit and cannot consume the operator/MCP budget. Open proposals expire after 14 days; expired proposals are omitted from lists and previews and cannot be approved. Snapshots are capped at the newest 20, except that the snapshot currently selected for publication is always retained.

## Versioning semantics

Snapshot **n holds the exact content of version n**; the original site is
version 0 and the current version has no snapshot row until it is replaced.
`publish {n}` serves exactly that content; `publishedVersion === currentVersion`
serves live data. Approving a proposal bumps the current version but never
moves the published pointer - re-publish (through the QA gate) to ship it.

## Operator console

`/admin` (session + CSRF): dashboard counts, prospect kanban with enforced FI
status transitions, intake forms, compose (3 deterministic variants), site
detail (claims, proposals, versions, publish/rollback, QA runs + launch checklist,
preview/panel tokens, comments, order, provisioning steps with evidence,
archive/restore/delete), `/admin/updates` queue, `/admin/provisioning`,
`/admin/claims` (filterable claim queue), `/admin/audit`, `/admin/deletions`. Every state change appends an audit row.

## MCP

`POST /api/mcp` is a stateless JSON-RPC 2.0 Streamable-HTTP endpoint using protocol version `2025-06-18`. Operator bearer required.

| Tool | Input | Result |
| --- | --- | --- |
| `get_site` | `{siteId}` | Current SiteData, version metadata, open proposal ids |
| `propose_update` | `{siteId, candidate, note?, updateRequestId?}` | Proposal id, tokened preview path, summary; links the update request when given |
| `list_proposals` | `{siteId}` | Open proposal ids and summaries |
| `list_update_requests` | `{siteId, status?}` | Queued email/panel/mcp update requests |
| `get_update_request` | `{siteId, requestId}` | One request with raw body |

There are intentionally no MCP tools for approval, rejection, rollback, or publishing. **AI proposes, humans approve.** Human approval happens through the REST/console workflow, and all serving routes remain staging-only and `noindex` until `BIZ_INDEXING_ENABLED` is turned on for published sites in production.
