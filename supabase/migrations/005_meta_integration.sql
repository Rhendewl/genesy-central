-- ─────────────────────────────────────────────────────────────────────────────
-- Lancaster SaaS — Migration 005: Integração Meta Ads
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Tokens OAuth (criptografados) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meta_tokens (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_account_id UUID REFERENCES ad_platform_accounts(id) ON DELETE CASCADE,
  encrypted_token     TEXT NOT NULL DEFAULT '',
  token_expires_at    TIMESTAMPTZ,
  ad_accounts         JSONB,         -- lista de contas disponíveis (estado pending)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_tokens_user_id            ON meta_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_meta_tokens_platform_account_id ON meta_tokens(platform_account_id);

CREATE TRIGGER update_meta_tokens_updated_at
  BEFORE UPDATE ON meta_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE meta_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_meta_tokens"
  ON meta_tokens FOR ALL USING (auth.uid() = user_id);

-- ── Logs de Sincronização ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meta_sync_logs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_account_id UUID REFERENCES ad_platform_accounts(id) ON DELETE SET NULL,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at         TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'running'
                        CHECK (status IN ('running', 'success', 'error')),
  campaigns_synced    INT NOT NULL DEFAULT 0,
  metrics_synced      INT NOT NULL DEFAULT 0,
  error_message       TEXT
);

CREATE INDEX IF NOT EXISTS idx_meta_sync_logs_user_id            ON meta_sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_meta_sync_logs_platform_account_id ON meta_sync_logs(platform_account_id);
CREATE INDEX IF NOT EXISTS idx_meta_sync_logs_started_at         ON meta_sync_logs(started_at DESC);

ALTER TABLE meta_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_meta_sync_logs"
  ON meta_sync_logs FOR ALL USING (auth.uid() = user_id);

-- ── Unique constraint em ad_platform_accounts ─────────────────────────────────
-- Garante que um user não conecte a mesma conta duas vezes

CREATE UNIQUE INDEX IF NOT EXISTS idx_apa_unique_user_platform_account
  ON ad_platform_accounts(user_id, platform, account_id)
  WHERE account_id IS NOT NULL;

-- ── external_ref para deduplicar expenses importadas ─────────────────────────
-- Permite upsert idempotente de despesas auto-importadas do Meta Ads

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS external_ref TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_external_ref
  ON expenses(user_id, external_ref) WHERE external_ref IS NOT NULL;

-- ── external_ref para traffic_costs ───────────────────────────────────────────

ALTER TABLE traffic_costs ADD COLUMN IF NOT EXISTS external_ref TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_traffic_costs_external_ref
  ON traffic_costs(user_id, external_ref) WHERE external_ref IS NOT NULL;
