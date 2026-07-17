-- H1: the same content-addressed R2 object may be referenced by multiple sites.
-- Keep one metadata row per (object, tenant) while preserving existing rows.

CREATE TABLE photos_h1 (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  r2_key       TEXT NOT NULL,
  site_id      INTEGER REFERENCES sites(id),
  content_type TEXT NOT NULL,
  bytes        INTEGER NOT NULL,
  created_at   INTEGER NOT NULL,
  UNIQUE (r2_key, site_id)
);

INSERT INTO photos_h1
  SELECT id, r2_key, site_id, content_type, bytes, created_at FROM photos;

DROP TABLE photos;
ALTER TABLE photos_h1 RENAME TO photos;

CREATE INDEX idx_photos_r2_key ON photos(r2_key);
CREATE INDEX idx_photos_site_id ON photos(site_id);
