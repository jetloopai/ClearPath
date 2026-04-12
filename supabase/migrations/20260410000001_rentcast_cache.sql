-- RentCast API response cache
-- Stores raw API responses per address so repeat lookups don't burn API quota.
-- TTLs enforced in application code: subject 30d, value 7d, rent 3d.

CREATE TABLE rentcast_cache (
  address         TEXT PRIMARY KEY,
  subject_raw     JSONB,
  value_raw       JSONB,
  rent_raw        JSONB,
  subject_cached_at  TIMESTAMPTZ,
  value_cached_at    TIMESTAMPTZ,
  rent_cached_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- No RLS needed — this table is only accessed via service role key (server-side)
