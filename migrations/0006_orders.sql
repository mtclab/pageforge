-- S8: orders, billing state, and append-only provider event storage.

CREATE TABLE orders (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id            TEXT NOT NULL UNIQUE,
  site_id              INTEGER NOT NULL REFERENCES sites(id),
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

CREATE TABLE billing_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER REFERENCES orders(id),
  type       TEXT NOT NULL,
  payload    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_orders_site_created
  ON orders(site_id, created_at DESC, id DESC);
CREATE UNIQUE INDEX idx_orders_one_open_per_site
  ON orders(site_id) WHERE status = 'luotu';
CREATE INDEX idx_billing_events_order_created
  ON billing_events(order_id, created_at DESC, id DESC);
