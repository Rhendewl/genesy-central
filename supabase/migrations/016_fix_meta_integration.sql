-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 016 — Fix Meta Integration (idempotente — seguro rodar N vezes)
--
-- Autocontida: cria todas as tabelas necessárias caso não existam.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 0. Função set_updated_at ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ── 1. leads — colunas necessárias para leads do Meta ────────────────────────

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS email         TEXT,
  ADD COLUMN IF NOT EXISTS source        TEXT    NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS page_id       TEXT,
  ADD COLUMN IF NOT EXISTS leadgen_id    TEXT,
  ADD COLUMN IF NOT EXISTS campaign_name TEXT,
  ADD COLUMN IF NOT EXISTS ad_name       TEXT,
  ADD COLUMN IF NOT EXISTS is_duplicate  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS form_id       TEXT,
  ADD COLUMN IF NOT EXISTS form_name     TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS leads_leadgen_id_unique
  ON leads(leadgen_id) WHERE leadgen_id IS NOT NULL;

-- ── 2. meta_webhook_logs ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meta_webhook_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload       JSONB,
  page_id       TEXT,
  form_id       TEXT,
  leadgen_id    TEXT,
  user_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  status        TEXT        NOT NULL DEFAULT 'received'
                              CHECK (status IN ('received', 'processed', 'duplicate', 'error', 'skipped')),
  step          TEXT,
  error_message TEXT,
  processed_at  TIMESTAMPTZ,
  lead_id       UUID        REFERENCES leads(id) ON DELETE SET NULL
);

-- Adiciona colunas que podem estar faltando se a tabela já existia
ALTER TABLE meta_webhook_logs
  ADD COLUMN IF NOT EXISTS form_id       TEXT,
  ADD COLUMN IF NOT EXISTS step          TEXT,
  ADD COLUMN IF NOT EXISTS received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Garante que o CHECK de status inclui 'skipped'
-- (não é possível alterar CHECK idempotente — ignorar se já existe)
DO $$ BEGIN
  ALTER TABLE meta_webhook_logs DROP CONSTRAINT IF EXISTS meta_webhook_logs_status_check;
  ALTER TABLE meta_webhook_logs ADD CONSTRAINT meta_webhook_logs_status_check
    CHECK (status IN ('received', 'processed', 'duplicate', 'error', 'skipped'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_whl_leadgen    ON meta_webhook_logs(leadgen_id);
CREATE INDEX IF NOT EXISTS idx_whl_status     ON meta_webhook_logs(status);
CREATE INDEX IF NOT EXISTS idx_whl_received   ON meta_webhook_logs(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_whl_form_id    ON meta_webhook_logs(form_id) WHERE form_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whl_user_id    ON meta_webhook_logs(user_id)  WHERE user_id IS NOT NULL;

ALTER TABLE meta_webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_webhook_logs" ON meta_webhook_logs;
DROP POLICY IF EXISTS "whl_select"             ON meta_webhook_logs;
DROP POLICY IF EXISTS "whl_insert"             ON meta_webhook_logs;
DROP POLICY IF EXISTS "whl_update"             ON meta_webhook_logs;

-- Usuário vê seus próprios logs; NULL user_id = evento ainda em processamento
CREATE POLICY "whl_select" ON meta_webhook_logs
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);

-- INSERT/UPDATE sem restrição de user_id pois o webhook usa service role (admin client)
CREATE POLICY "whl_insert" ON meta_webhook_logs
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "whl_update" ON meta_webhook_logs
  FOR UPDATE USING (TRUE);

-- ── 3. meta_page_subscriptions ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meta_page_subscriptions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_account_id   UUID,
  page_id               TEXT,
  meta_page_id          TEXT,
  page_name             TEXT,
  access_token          TEXT,
  encrypted_page_token  TEXT,
  page_token_expires_at TIMESTAMPTZ,
  is_active             BOOLEAN     NOT NULL DEFAULT TRUE,
  subscribed            BOOLEAN     NOT NULL DEFAULT FALSE,
  last_synced_at        TIMESTAMPTZ,
  error_message         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Adiciona colunas que podem estar faltando em tabelas pré-existentes
ALTER TABLE meta_page_subscriptions
  ADD COLUMN IF NOT EXISTS meta_page_id          TEXT,
  ADD COLUMN IF NOT EXISTS page_id               TEXT,
  ADD COLUMN IF NOT EXISTS encrypted_page_token  TEXT,
  ADD COLUMN IF NOT EXISTS page_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_synced_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS platform_account_id   UUID,
  ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Sincroniza page_id ↔ meta_page_id para linhas existentes
UPDATE meta_page_subscriptions
  SET meta_page_id = page_id
  WHERE meta_page_id IS NULL AND page_id IS NOT NULL;

UPDATE meta_page_subscriptions
  SET page_id = meta_page_id
  WHERE page_id IS NULL AND meta_page_id IS NOT NULL;

-- CRITICAL: índice único para o upsert de páginas funcionar com onConflict: "user_id,meta_page_id"
CREATE UNIQUE INDEX IF NOT EXISTS uq_mps_user_meta_page_id
  ON meta_page_subscriptions(user_id, meta_page_id)
  WHERE meta_page_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mps_user_id      ON meta_page_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_mps_meta_page_id ON meta_page_subscriptions(meta_page_id);
CREATE INDEX IF NOT EXISTS idx_mps_page_id      ON meta_page_subscriptions(page_id);

DROP TRIGGER IF EXISTS trg_mps_updated_at ON meta_page_subscriptions;
CREATE TRIGGER trg_mps_updated_at
  BEFORE UPDATE ON meta_page_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE meta_page_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_page_subs" ON meta_page_subscriptions;
DROP POLICY IF EXISTS "mps_select"          ON meta_page_subscriptions;
DROP POLICY IF EXISTS "mps_insert"          ON meta_page_subscriptions;
DROP POLICY IF EXISTS "mps_update"          ON meta_page_subscriptions;
DROP POLICY IF EXISTS "mps_delete"          ON meta_page_subscriptions;

CREATE POLICY "mps_select" ON meta_page_subscriptions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "mps_insert" ON meta_page_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "mps_update" ON meta_page_subscriptions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "mps_delete" ON meta_page_subscriptions
  FOR DELETE USING (user_id = auth.uid());

-- ── 4. meta_form_subscriptions ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meta_form_subscriptions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id      TEXT        NOT NULL,
  form_id      TEXT        NOT NULL,
  form_name    TEXT,
  is_active    BOOLEAN     NOT NULL DEFAULT FALSE,
  leads_count  INTEGER     NOT NULL DEFAULT 0,
  last_lead_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, form_id)
);

ALTER TABLE meta_form_subscriptions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS trg_mfs_updated_at ON meta_form_subscriptions;
CREATE TRIGGER trg_mfs_updated_at
  BEFORE UPDATE ON meta_form_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_mfs_user_id ON meta_form_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_mfs_page_id ON meta_form_subscriptions(page_id);
CREATE INDEX IF NOT EXISTS idx_mfs_form_id ON meta_form_subscriptions(form_id);
CREATE INDEX IF NOT EXISTS idx_mfs_active  ON meta_form_subscriptions(user_id, page_id) WHERE is_active = TRUE;

ALTER TABLE meta_form_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_form_subs" ON meta_form_subscriptions;
DROP POLICY IF EXISTS "mfs_select"          ON meta_form_subscriptions;
DROP POLICY IF EXISTS "mfs_insert"          ON meta_form_subscriptions;
DROP POLICY IF EXISTS "mfs_update"          ON meta_form_subscriptions;
DROP POLICY IF EXISTS "mfs_delete"          ON meta_form_subscriptions;

CREATE POLICY "mfs_select" ON meta_form_subscriptions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "mfs_insert" ON meta_form_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "mfs_update" ON meta_form_subscriptions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "mfs_delete" ON meta_form_subscriptions
  FOR DELETE USING (user_id = auth.uid());

-- ── FIM ───────────────────────────────────────────────────────────────────────
-- Tabelas garantidas:
--   leads                    — colunas Meta (email, source, leadgen_id, form_id, …)
--   meta_webhook_logs        — log granular com step + status 'skipped'
--   meta_page_subscriptions  — page_id + meta_page_id + UNIQUE para upsert
--   meta_form_subscriptions  — toggle por formulário com RLS correto
