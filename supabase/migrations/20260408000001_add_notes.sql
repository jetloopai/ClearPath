-- Add notes column to analyses for per-deal investor notes
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;
