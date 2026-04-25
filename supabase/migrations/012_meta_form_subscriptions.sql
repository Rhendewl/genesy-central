-- ── Migration 012: Meta Lead Ads — Form-level subscriptions ──────────────────

-- 1. Store page access tokens (needed to call /{page}/leadgen_forms API)
ALTER TABLE meta_page_subscriptions
  ADD COLUMN IF NOT EXISTS encrypted_page_token TEXT;

-- 2. Track which lead gen form each lead came from
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS form_id   TEXT,
  ADD COLUMN IF NOT EXISTS form_name TEXT;

-- 3. Per-form capture subscriptions
--    If user has any rows here for a page, only those active forms are captured.
--    Empty = capture all forms from that page.
CREATE TABLE IF NOT EXISTS meta_form_subscriptions (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id       TEXT        NOT NULL,
  form_id       TEXT        NOT NULL,
  form_name     TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  leads_count   INTEGER     NOT NULL DEFAULT 0,
  last_lead_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, form_id)
);

CREATE INDEX IF NOT EXISTS idx_form_subs_page_id ON meta_form_subscriptions(page_id);
CREATE INDEX IF NOT EXISTS idx_form_subs_user    ON meta_form_subscriptions(user_id);

ALTER TABLE meta_form_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'meta_form_subscriptions' AND policyname = 'users_own_form_subs'
  ) THEN
    CREATE POLICY "users_own_form_subs" ON meta_form_subscriptions
      FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;
