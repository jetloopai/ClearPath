-- Support buyer entities signing via a representative, and let the buyer
-- pre-fill the seller's name for a personalized letter/salutation.
ALTER TABLE offers ADD COLUMN IF NOT EXISTS buyer_representative_name TEXT;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS seller_name TEXT;
