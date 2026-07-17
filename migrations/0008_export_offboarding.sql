-- S10: export/offboarding deletion ledger. The ledger deliberately keeps the
-- raw site identifiers after the source site has been permanently removed.
CREATE TABLE deletion_log (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id        INTEGER NOT NULL,
  site_public_id TEXT NOT NULL,
  item           TEXT NOT NULL,
  detail         TEXT,
  actor          TEXT NOT NULL,
  created_at     INTEGER NOT NULL
);

CREATE INDEX idx_deletion_log_created
  ON deletion_log(id DESC);
CREATE INDEX idx_deletion_log_site
  ON deletion_log(site_public_id, id DESC);

-- Orders are bookkeeping records and must outlive their site. Keep site_id as
-- the original raw identifier, but remove the FK that would block site erasure.
-- Rebuild the dependent billing_events table too so the migration works while
-- foreign-key enforcement remains enabled throughout.

CREATE TABLE orders_s10 (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id            TEXT NOT NULL UNIQUE,
  site_id              INTEGER NOT NULL,
  kind                 TEXT NOT NULL CHECK (kind IN ('build_and_host')),
  status               TEXT NOT NULL DEFAULT 'luotu' CHECK (status IN (
                         'luotu','maksettu','peruttu','maksu_epaonnistui','irtisanottu')),
  provider             TEXT NOT NULL,
  provider_session_id  TEXT,
  provider_sub_id      TEXT,
  amount_build_cents   INTEGER NOT NULL,
  amount_monthly_cents INTEGER NOT NULL,
  currency             TEXT NOT NULL DEFAULT 'eur',
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL
);

INSERT INTO orders_s10
  SELECT id, public_id, site_id, kind, status, provider, provider_session_id,
         provider_sub_id, amount_build_cents, amount_monthly_cents, currency,
         created_at, updated_at
    FROM orders;

CREATE TABLE billing_events_s10 (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER REFERENCES orders_s10(id),
  type       TEXT NOT NULL,
  payload    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

INSERT INTO billing_events_s10
  SELECT id, order_id, type, payload, created_at FROM billing_events;

DROP TABLE billing_events;
DROP TABLE orders;
ALTER TABLE orders_s10 RENAME TO orders;
ALTER TABLE billing_events_s10 RENAME TO billing_events;

CREATE INDEX idx_orders_site_created
  ON orders(site_id, created_at DESC, id DESC);
CREATE UNIQUE INDEX idx_orders_one_open_per_site
  ON orders(site_id) WHERE status = 'luotu';
CREATE INDEX idx_billing_events_order_created
  ON billing_events(order_id, created_at DESC, id DESC);
