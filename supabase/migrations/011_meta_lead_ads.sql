-- ── Migration 011: Meta Lead Ads → CRM integration ───────────────────────────

-- 1. Extend leads table with Meta Lead Ads fields
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS email         TEXT,
  ADD COLUMN IF NOT EXISTS source        TEXT    NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS page_id       TEXT,
  ADD COLUMN IF NOT EXISTS leadgen_id    TEXT,
  ADD COLUMN IF NOT EXISTS campaign_name TEXT,
  ADD COLUMN IF NOT EXISTS ad_name       TEXT,
  ADD COLUMN IF NOT EXISTS is_duplicate  BOOLEAN NOT NULL DEFAULT FALSE;

-- Prevent reprocessing the same lead form submission
CREATE UNIQUE INDEX IF NOT EXISTS leads_leadgen_id_unique
  ON leads(leadgen_id) WHERE leadgen_id IS NOT NULL;

-- 2. Webhook event log
CREATE TABLE IF NOT EXISTS meta_webhook_logs (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload       JSONB,
  page_id       TEXT,
  leadgen_id    TEXT,
  user_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  status        TEXT        NOT NULL DEFAULT 'received'
                              CHECK (status IN ('received', 'processed', 'duplicate', 'error')),
  error_message TEXT,
  processed_at  TIMESTAMPTZ,
  lead_id       UUID        REFERENCES leads(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_leadgen  ON meta_webhook_logs(leadgen_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status   ON meta_webhook_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_received ON meta_webhook_logs(received_at DESC);

-- 3. Page → user mapping
--    Populated when user connects Meta account (fetched via /me/accounts)
CREATE TABLE IF NOT EXISTS meta_page_subscriptions (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_account_id UUID        REFERENCES ad_platform_accounts(id) ON DELETE CASCADE,
  page_id             TEXT        NOT NULL,
  page_name           TEXT,
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, page_id)
);

CREATE INDEX IF NOT EXISTS idx_page_subs_page_id ON meta_page_subscriptions(page_id);

-- 4. RLS
ALTER TABLE meta_webhook_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_page_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'meta_webhook_logs' AND policyname = 'users_own_webhook_logs'
  ) THEN
    CREATE POLICY "users_own_webhook_logs" ON meta_webhook_logs
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'meta_page_subscriptions' AND policyname = 'users_own_page_subs'
  ) THEN
    CREATE POLICY "users_own_page_subs" ON meta_page_subscriptions
      FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;
