-- User profiles table
-- Tracks plan, credits, and Stripe billing info per user.
-- Auto-created on sign-up via trigger.

CREATE TABLE user_profiles (
  id                     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan                   TEXT NOT NULL DEFAULT 'free',   -- 'free' | 'starter' | 'pro'
  credits_remaining      INTEGER NOT NULL DEFAULT 3,
  credits_monthly        INTEGER NOT NULL DEFAULT 3,
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  current_period_end     TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_user_profiles_stripe_customer ON user_profiles (stripe_customer_id);

-- Auto-create a free profile whenever a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
