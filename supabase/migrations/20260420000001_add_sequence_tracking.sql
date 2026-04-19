ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS sequence_step INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS next_email_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS leads_next_email_at_idx ON leads (next_email_at)
  WHERE next_email_at IS NOT NULL AND sequence_paused = false;
