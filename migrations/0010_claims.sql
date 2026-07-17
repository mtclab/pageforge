-- S11: self-service claims from outbound draft previews.

CREATE TABLE claims (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id     INTEGER NOT NULL REFERENCES sites(id),
  order_id    INTEGER REFERENCES orders(id),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  domain_wish TEXT,
  message     TEXT,
  status      TEXT NOT NULL DEFAULT 'uusi' CHECK (status IN (
                'uusi','maksettu','peruttu')),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE UNIQUE INDEX idx_claims_one_open_per_site
  ON claims(site_id) WHERE status = 'uusi';
CREATE INDEX idx_claims_order
  ON claims(order_id);
CREATE INDEX idx_claims_status_created
  ON claims(status, created_at DESC, id DESC);
