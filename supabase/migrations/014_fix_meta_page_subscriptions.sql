-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 014 — Fix meta_page_subscriptions schema
--
-- Contexto: migration 013 criou a tabela em base limpa com meta_page_id/access_token.
-- O app usa encrypted_page_token — esta migration adiciona as colunas faltantes.
-- Idempotente: seguro rodar múltiplas vezes.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. FK platform_account_id (omitida na criação da migration 013) ──────────

ALTER TABLE meta_page_subscriptions
  ADD COLUMN IF NOT EXISTS platform_account_id UUID REFERENCES ad_platform_accounts(id) ON DELETE SET NULL;

-- ── 2. Colunas do token (críticas — causam o erro de sync) ────────────────────

ALTER TABLE meta_page_subscriptions
  ADD COLUMN IF NOT EXISTS encrypted_page_token  TEXT,
  ADD COLUMN IF NOT EXISTS page_token_expires_at TIMESTAMPTZ;

-- ── 2. Colunas de auditoria/sync ──────────────────────────────────────────────

ALTER TABLE meta_page_subscriptions
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_message  TEXT;

-- ── 3. Colunas de compatibilidade com o código que ainda usa page_id ──────────

ALTER TABLE meta_page_subscriptions
  ADD COLUMN IF NOT EXISTS page_id TEXT;

-- Popula page_id a partir de meta_page_id para linhas existentes
UPDATE meta_page_subscriptions
  SET page_id = meta_page_id
  WHERE page_id IS NULL;

-- ── 4. Índices e constraint para upsert onConflict("user_id,page_id") ─────────

CREATE INDEX IF NOT EXISTS idx_mps_page_id ON meta_page_subscriptions(page_id);

-- Necessário para o upsert do app funcionar com onConflict: "user_id,page_id"
CREATE UNIQUE INDEX IF NOT EXISTS uq_mps_user_page_id
  ON meta_page_subscriptions(user_id, page_id)
  WHERE page_id IS NOT NULL;

-- ── RESULTADO FINAL — colunas da tabela ───────────────────────────────────────
--   id                    UUID         PK
--   user_id               UUID         NOT NULL FK auth.users
--   meta_page_id          TEXT         NOT NULL  (coluna original da migration 013)
--   page_id               TEXT         ← adicionado para compatibilidade com app
--   page_name             TEXT
--   access_token          TEXT         (coluna original da migration 013)
--   encrypted_page_token  TEXT         ← adicionado
--   page_token_expires_at TIMESTAMPTZ  ← adicionado
--   is_active             BOOLEAN      NOT NULL DEFAULT TRUE
--   subscribed            BOOLEAN      NOT NULL DEFAULT FALSE
--   last_synced_at        TIMESTAMPTZ  ← adicionado
--   error_message         TEXT         ← adicionado
--   created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
--   updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
