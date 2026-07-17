-- S6: persisted deterministic QA runs and the operator launch checklist.

CREATE TABLE qa_runs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id    INTEGER NOT NULL REFERENCES sites(id),
  version    INTEGER NOT NULL,
  results    TEXT NOT NULL,
  passed     INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE launch_checklist (
  site_id    INTEGER NOT NULL REFERENCES sites(id),
  item       TEXT NOT NULL,
  checked_at INTEGER NOT NULL,
  checked_by TEXT NOT NULL,
  PRIMARY KEY (site_id, item)
);

CREATE INDEX idx_qa_runs_site_created
  ON qa_runs(site_id, created_at DESC, id DESC);
