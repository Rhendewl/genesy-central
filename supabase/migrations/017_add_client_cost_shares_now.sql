-- =============================================================================
-- RODAR NO SUPABASE SQL EDITOR AGORA
-- Cria tabela client_cost_shares para comissões/parceiros.
-- Idempotente — pode rodar quantas vezes quiser sem erro.
-- =============================================================================

CREATE TABLE IF NOT EXISTS client_cost_shares (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id   UUID NOT NULL REFERENCES agency_clients(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  name        TEXT NOT NULL,
  percentage  NUMERIC(5,2) NOT NULL DEFAULT 0
                CHECK (percentage >= 0 AND percentage <= 100),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_cost_shares_client_id ON client_cost_shares(client_id);
CREATE INDEX IF NOT EXISTS idx_client_cost_shares_user_id   ON client_cost_shares(user_id);

ALTER TABLE client_cost_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own client cost shares" ON client_cost_shares;
CREATE POLICY "Users can manage own client cost shares"
  ON client_cost_shares FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
