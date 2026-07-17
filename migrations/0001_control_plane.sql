-- Mikoshi control plane (epic #35). D1 is the source of truth for business
-- sites, drafts, prospects, photos, and the append-only audit trail. KV is
-- demoted to a render cache; R2 holds photo bytes. Everything here is staging
-- only and gated behind MUTATION_API_ENABLED.
--
-- Conventions: INTEGER PRIMARY KEY AUTOINCREMENT internal ids, TEXT public ids,
-- created_at/updated_at are INTEGER millisecond epochs, snake_case columns.

-- Discovery leads and their pipeline state (S2 fills the operator console).
CREATE TABLE prospects (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id     TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  y_tunnus      TEXT,
  municipality  TEXT,
  vertical      TEXT,
  source        TEXT,
  status        TEXT NOT NULL CHECK (status IN (
                  'loytynyt','arvioitu','luonnos','yhteydenotto',
                  'vastasi','myyty','julkaistu','yllapidossa','hylatty')),
  status_reason TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  notes         TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

-- Structured intake (S3 defines the BusinessProfile JSON shape; store opaque now).
CREATE TABLE business_profiles (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id    TEXT NOT NULL UNIQUE,
  prospect_id  INTEGER REFERENCES prospects(id),
  data         TEXT NOT NULL,
  consent_note TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

-- The published business site: current data is source of truth, version bumped
-- transactionally alongside an immutable snapshot in draft_versions.
CREATE TABLE sites (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id         TEXT NOT NULL UNIQUE,
  prospect_id       INTEGER REFERENCES prospects(id),
  approval_key_hash TEXT NOT NULL,
  current_version   INTEGER NOT NULL DEFAULT 0,
  data              TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
                      'draft','staged','approved','published','archived')),
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);

-- Immutable version history. kind='snapshot' rows are prior current states with
-- a per-site version number n; kind='proposal' rows are staged candidates with
-- an 8-char public_id and a lifecycle status. n is NULL for proposals.
CREATE TABLE draft_versions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id    INTEGER NOT NULL REFERENCES sites(id),
  n          INTEGER,
  data       TEXT NOT NULL,
  note       TEXT,
  kind       TEXT NOT NULL CHECK (kind IN ('snapshot','proposal')),
  status     TEXT CHECK (status IN ('open','approved','rejected','superseded')),
  summary    TEXT,
  public_id  TEXT,
  created_at INTEGER NOT NULL
);

-- Photo bytes live in R2 under photos/<sha256>; this is the metadata + dedup key.
CREATE TABLE photos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  r2_key       TEXT NOT NULL UNIQUE,
  site_id      INTEGER REFERENCES sites(id),
  content_type TEXT NOT NULL,
  bytes        INTEGER NOT NULL,
  created_at   INTEGER NOT NULL
);

-- Append-only audit trail. Never updated, never deleted.
CREATE TABLE audit_events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  at        INTEGER NOT NULL,
  actor     TEXT NOT NULL CHECK (actor IN ('operator','approval-key','mcp','system')),
  action    TEXT NOT NULL,
  entity    TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  detail    TEXT
);

CREATE UNIQUE INDEX idx_sites_public_id ON sites(public_id);
CREATE INDEX idx_draft_versions_site ON draft_versions(site_id);
-- One version number n per site among snapshots (proposals have NULL n).
CREATE UNIQUE INDEX idx_draft_versions_snapshot_n
  ON draft_versions(site_id, n) WHERE kind = 'snapshot';
CREATE UNIQUE INDEX idx_draft_versions_proposal_public
  ON draft_versions(public_id) WHERE kind = 'proposal';
CREATE INDEX idx_audit_entity ON audit_events(entity, entity_id);
CREATE INDEX idx_prospects_status ON prospects(status);
