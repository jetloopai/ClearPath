-- Purchase offers with in-app e-signature support.
-- id doubles as the unguessable public signing-link token, same pattern
-- already used for analyses/[id] via the /r/[id] share route.
CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID REFERENCES analyses(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Denormalized snapshot of the offer terms, so the letter stays correct
  -- even if the source analysis later changes.
  address TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  offer_price INT NOT NULL,
  earnest_money INT NOT NULL,
  closing_days INT NOT NULL,
  inspection_days INT NOT NULL,
  expiration_days INT NOT NULL,
  arv INT,
  rehab_estimate INT,
  mao INT,

  seller_email TEXT,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'expired', 'voided')),
  expires_at TIMESTAMPTZ NOT NULL,

  signed_at TIMESTAMPTZ,
  signer_name TEXT,
  signature_data TEXT,
  signer_ip TEXT,
  agreed_to_terms BOOLEAN,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS offers_analysis_id_idx ON offers(analysis_id);
CREATE INDEX IF NOT EXISTS offers_user_id_idx ON offers(user_id);
CREATE INDEX IF NOT EXISTS offers_status_idx ON offers(status);

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON offers FOR SELECT USING (true);
CREATE POLICY "Service write" ON offers FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service update" ON offers FOR UPDATE USING (auth.role() = 'service_role');
