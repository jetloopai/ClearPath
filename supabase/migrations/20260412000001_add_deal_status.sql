-- Add deal pipeline status to analyses table
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS deal_status TEXT DEFAULT 'analyzing'
  CHECK (deal_status IN ('analyzing', 'offer_made', 'under_contract', 'closed', 'dead'));

CREATE INDEX IF NOT EXISTS analyses_deal_status_idx ON analyses(deal_status);
