# Mikoshi mutation API

The mutation API is a staging-only surface for Finnish small-business card sites. It is closed by default and does not deploy or publish to production custom domains.

## Environment and authentication

Both of these conditions must be true before any `/api/biz/*`, `/api/mcp`, `/p/*`, or `/b/*` route opens:

- `MUTATION_API_ENABLED=true`
- `OPERATOR_KEY` is set

`wrangler.toml` keeps `MUTATION_API_ENABLED="false"`. Never put `OPERATOR_KEY` there. For local staging, set it in `.dev.vars` or pass it to `wrangler dev` with `--var OPERATOR_KEY:<secret>`. Closed routes return 404.

Operator requests use `Authorization: Bearer <OPERATOR_KEY>`. Creating a site returns a per-site approval key once; only its SHA-256 hash is stored. Site reads, approval, rejection, and rollback accept either the operator key or that site's approval key. Proposal creation and MCP require the operator key.

## REST endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/biz/sites` | Operator | Create a site and return its id and one-time approval key |
| GET | `/api/biz/sites/:id` | Operator or approval key | Read current data, version metadata, and open proposal ids |
| POST | `/api/biz/sites/:id/proposals` | Operator | Validate and stage a complete candidate |
| GET | `/p/:id/:pid` | Gated public preview | Render an open proposal with a draft banner and `noindex` |
| POST | `/api/biz/sites/:id/proposals/:pid/approve` | Operator or approval key | Snapshot current data and make the candidate current |
| POST | `/api/biz/sites/:id/proposals/:pid/reject` | Operator or approval key | Close a proposal without changing the site |
| POST | `/api/biz/sites/:id/rollback` | Operator or approval key | Snapshot current data and restore a selected version |
| GET | `/b/:id` | Gated public preview | Render current data with `noindex` |

Proposal creation is limited to 50 per site per UTC day. Proposals expire from KV after 14 days. Previous current states are stored newest-first, with at most 20 snapshots.

## Lifecycle

```text
current site
    |
    | operator proposes complete candidate
    v
open proposal ---- customer/operator rejects ----> rejected
    |
    | customer/operator approves
    v
snapshot previous current -> candidate becomes current
    |
    | customer/operator rolls back to snapshot n
    v
snapshot replaced current -> selected snapshot becomes current
```

## MCP

`POST /api/mcp` is a stateless JSON-RPC 2.0 Streamable-HTTP endpoint using protocol version `2025-06-18`. JSON-RPC requests receive one JSON response, while `notifications/initialized` receives an empty 202 response. There are no sessions, SSE streams, or SDK dependency.

| Tool | Input | Result |
| --- | --- | --- |
| `get_site` | `{siteId}` | Current SiteData, version metadata, and open proposal ids |
| `propose_update` | `{siteId, candidate, note?}` | Proposal id, preview path, and deterministic summary |
| `list_proposals` | `{siteId}` | Open proposal ids and summaries |

There are intentionally no MCP tools for approval, rejection, rollback, or publishing. **AI proposes, humans approve.** Human approval must happen outside MCP through the REST workflow, and all serving routes remain staging-only and `noindex`.
