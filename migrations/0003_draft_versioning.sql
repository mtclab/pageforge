-- S5: leak-safe preview capabilities, customer feedback, and an explicit
-- pointer to the exact version served on the public business URL.

ALTER TABLE sites ADD COLUMN published_version INTEGER;

CREATE TABLE preview_tokens (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash         TEXT NOT NULL UNIQUE,
  site_id            INTEGER NOT NULL REFERENCES sites(id),
  proposal_public_id TEXT,
  label              TEXT NOT NULL,
  expires_at         INTEGER NOT NULL,
  revoked_at         INTEGER,
  created_at         INTEGER NOT NULL
);

CREATE TABLE draft_comments (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id            INTEGER NOT NULL REFERENCES sites(id),
  proposal_public_id TEXT,
  author             TEXT NOT NULL CHECK (author IN ('operator','customer')),
  body               TEXT NOT NULL,
  created_at         INTEGER NOT NULL
);

CREATE INDEX idx_preview_tokens_site_active
  ON preview_tokens(site_id, revoked_at, expires_at);
CREATE INDEX idx_draft_comments_site_created
  ON draft_comments(site_id, created_at DESC);
