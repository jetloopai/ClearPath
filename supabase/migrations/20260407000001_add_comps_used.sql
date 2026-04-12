-- Add comps_used JSONB column to store comparable sales with each analysis
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS comps_used JSONB DEFAULT '[]'::jsonb;
