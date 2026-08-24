-- FrenlyCoins Casino mode: wallet + transactions
-- Writes are server-authoritative only (service-role key, via /api/casino/*).
-- No client-side write policy on purpose: RNG and balance mutation must
-- happen in the API route, never trusted from the browser.

CREATE TABLE IF NOT EXISTS casino_wallets (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance INT NOT NULL DEFAULT 250,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS casino_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  game_slug TEXT NOT NULL,
  type TEXT NOT NULL, -- 'bet' | 'win' | 'bonus' | 'safety_net'
  amount INT NOT NULL, -- signed: negative = mise/perte, positive = gain/bonus
  balance_after INT NOT NULL,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS casino_transactions_user_idx ON casino_transactions(user_id, created_at DESC);

ALTER TABLE casino_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE casino_transactions ENABLE ROW LEVEL SECURITY;

-- Public read (consistent with the rest of the app's RLS posture) — no
-- insert/update/delete policy for anon/authenticated, so only the
-- service-role key (used exclusively server-side) can mutate balances.
CREATE POLICY "Public read casino_wallets" ON casino_wallets FOR SELECT USING (true);
CREATE POLICY "Public read casino_transactions" ON casino_transactions FOR SELECT USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE casino_wallets;
