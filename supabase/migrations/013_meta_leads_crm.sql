-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 013 — Meta Leads CRM
-- Idempotente: seguro rodar múltiplas vezes no SQL Editor do Supabase.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Função updated_at (criada uma vez) ─────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ── 2. meta_page_subscriptions ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meta_page_subscriptions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meta_page_id TEXT        NOT NULL,
  page_name    TEXT,
  access_token TEXT,
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  subscribed   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, meta_page_id)
);

DROP TRIGGER IF EXISTS trg_meta_page_subscriptions_updated_at ON meta_page_subscriptions;
CREATE TRIGGER trg_meta_page_subscriptions_updated_at
  BEFORE UPDATE ON meta_page_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 3. meta_lead_forms ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meta_lead_forms (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meta_page_id TEXT        NOT NULL,
  meta_form_id TEXT        NOT NULL,
  form_name    TEXT,
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, meta_form_id)
);

DROP TRIGGER IF EXISTS trg_meta_lead_forms_updated_at ON meta_lead_forms;
CREATE TRIGGER trg_meta_lead_forms_updated_at
  BEFORE UPDATE ON meta_lead_forms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 4. meta_lead_logs ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meta_lead_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  meta_page_id TEXT,
  meta_form_id TEXT,
  leadgen_id   TEXT,
  status       TEXT,
  payload      JSONB       NOT NULL DEFAULT '{}'::JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 5. Índices ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_mps_user_id      ON meta_page_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_mps_meta_page_id ON meta_page_subscriptions(meta_page_id);

CREATE INDEX IF NOT EXISTS idx_mlf_user_id      ON meta_lead_forms(user_id);
CREATE INDEX IF NOT EXISTS idx_mlf_meta_page_id ON meta_lead_forms(meta_page_id);
CREATE INDEX IF NOT EXISTS idx_mlf_meta_form_id ON meta_lead_forms(meta_form_id);

CREATE INDEX IF NOT EXISTS idx_mll_user_id      ON meta_lead_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_mll_meta_page_id ON meta_lead_logs(meta_page_id);
CREATE INDEX IF NOT EXISTS idx_mll_leadgen_id   ON meta_lead_logs(leadgen_id);
CREATE INDEX IF NOT EXISTS idx_mll_status       ON meta_lead_logs(status);
CREATE INDEX IF NOT EXISTS idx_mll_created_at   ON meta_lead_logs(created_at DESC);

-- ── 6. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE meta_page_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_lead_forms         ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_lead_logs          ENABLE ROW LEVEL SECURITY;

-- ── 7. Policies — meta_page_subscriptions ─────────────────────────────────────

DROP POLICY IF EXISTS "mps_select" ON meta_page_subscriptions;
DROP POLICY IF EXISTS "mps_insert" ON meta_page_subscriptions;
DROP POLICY IF EXISTS "mps_update" ON meta_page_subscriptions;
DROP POLICY IF EXISTS "mps_delete" ON meta_page_subscriptions;

CREATE POLICY "mps_select" ON meta_page_subscriptions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "mps_insert" ON meta_page_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "mps_update" ON meta_page_subscriptions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "mps_delete" ON meta_page_subscriptions
  FOR DELETE USING (user_id = auth.uid());

-- ── 8. Policies — meta_lead_forms ─────────────────────────────────────────────

DROP POLICY IF EXISTS "mlf_select" ON meta_lead_forms;
DROP POLICY IF EXISTS "mlf_insert" ON meta_lead_forms;
DROP POLICY IF EXISTS "mlf_update" ON meta_lead_forms;
DROP POLICY IF EXISTS "mlf_delete" ON meta_lead_forms;

CREATE POLICY "mlf_select" ON meta_lead_forms
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "mlf_insert" ON meta_lead_forms
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "mlf_update" ON meta_lead_forms
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "mlf_delete" ON meta_lead_forms
  FOR DELETE USING (user_id = auth.uid());

-- ── 9. Policies — meta_lead_logs ──────────────────────────────────────────────

DROP POLICY IF EXISTS "mll_select" ON meta_lead_logs;
DROP POLICY IF EXISTS "mll_insert" ON meta_lead_logs;

CREATE POLICY "mll_select" ON meta_lead_logs
  FOR SELECT USING (user_id = auth.uid());

-- INSERT sem restrição de user_id pois o webhook (service role) insere sem sessão
CREATE POLICY "mll_insert" ON meta_lead_logs
  FOR INSERT WITH CHECK (TRUE);
