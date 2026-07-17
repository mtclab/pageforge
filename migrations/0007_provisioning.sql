-- S9: supervised provisioning runs and the renewal monitor model.

CREATE TABLE provisioning_runs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id  TEXT NOT NULL UNIQUE,
  site_id    INTEGER NOT NULL REFERENCES sites(id),
  order_id   INTEGER REFERENCES orders(id),
  domain     TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'kaynnissa' CHECK (status IN (
               'kaynnissa','valmis','keskeytetty')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE provisioning_steps (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id     INTEGER NOT NULL REFERENCES provisioning_runs(id),
  step       TEXT NOT NULL,
  ord        INTEGER NOT NULL,
  status     TEXT NOT NULL DEFAULT 'odottaa' CHECK (status IN (
               'odottaa','tehty','ohitettu','epaonnistui')),
  evidence   TEXT,
  updated_at INTEGER NOT NULL,
  UNIQUE (run_id, step)
);

CREATE TABLE renewals (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id    INTEGER NOT NULL REFERENCES sites(id),
  kind       TEXT NOT NULL CHECK (kind IN ('domain','postilaatikko')),
  label      TEXT NOT NULL,
  due_at     INTEGER NOT NULL,
  status     TEXT NOT NULL DEFAULT 'tulossa' CHECK (status IN (
               'tulossa','hoidettu')),
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX idx_provisioning_one_active_per_site
  ON provisioning_runs(site_id) WHERE status = 'kaynnissa';
CREATE INDEX idx_provisioning_steps_run_ord
  ON provisioning_steps(run_id, ord);
CREATE INDEX idx_renewals_due
  ON renewals(status, due_at);
