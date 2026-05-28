-- ─────────────────────────────────────────────────────────────────────────────
-- Lancaster SaaS — Migration 032: Configurações de IA por usuário
-- ─────────────────────────────────────────────────────────────────────────────
-- As chaves de API ficam no banco (com RLS), nunca expostas no cliente.
-- O pipeline lê do banco em cada request server-side.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS criativo_configs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  anthropic_api_key   TEXT,
  openai_api_key      TEXT,
  gemini_api_key      TEXT,
  -- qual provider usar para copy e para imagem
  provider_copy       TEXT        NOT NULL DEFAULT 'anthropic'
                                    CHECK (provider_copy IN ('anthropic', 'gemini', 'openai')),
  provider_imagem     TEXT        NOT NULL DEFAULT 'openai'
                                    CHECK (provider_imagem IN ('openai', 'gemini')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_criativo_configs_user_id ON criativo_configs(user_id);

CREATE TRIGGER update_criativo_configs_updated_at
  BEFORE UPDATE ON criativo_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE criativo_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_criativo_configs" ON criativo_configs;
CREATE POLICY "users_own_criativo_configs"
  ON criativo_configs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
