-- S7: customer update queue and capability-scoped customer panel links.

CREATE TABLE update_requests (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id            INTEGER NOT NULL REFERENCES sites(id),
  channel            TEXT NOT NULL CHECK (channel IN ('email','panel','mcp')),
  from_addr          TEXT,
  subject            TEXT,
  body               TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'uusi' CHECK (status IN ('uusi','ehdotettu','suljettu')),
  proposal_public_id TEXT,
  created_at         INTEGER NOT NULL
);

CREATE TABLE panel_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  site_id    INTEGER NOT NULL REFERENCES sites(id),
  expires_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000 + 2592000000),
  revoked_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_update_requests_status_created
  ON update_requests(status, created_at DESC, id DESC);
CREATE INDEX idx_update_requests_site_status
  ON update_requests(site_id, status, created_at DESC, id DESC);
CREATE INDEX idx_panel_tokens_site_active
  ON panel_tokens(site_id, revoked_at, expires_at);
