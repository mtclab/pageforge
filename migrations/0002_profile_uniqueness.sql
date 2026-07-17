-- S3: intake and compose are one-per-prospect operations. These indexes make
-- the server-side upsert/idempotency checks durable under concurrent requests.
CREATE UNIQUE INDEX idx_business_profiles_prospect
  ON business_profiles(prospect_id) WHERE prospect_id IS NOT NULL;

CREATE UNIQUE INDEX idx_sites_prospect
  ON sites(prospect_id) WHERE prospect_id IS NOT NULL;
