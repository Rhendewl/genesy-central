-- =============================================================================
-- Geographic metrics breakdown per campaign (region breakdown from Meta Ads)
-- Idempotente: pode ser executado várias vezes sem erro
-- Executar no Supabase → SQL Editor → New query → Run
-- =============================================================================

CREATE TABLE IF NOT EXISTS campaign_geo_metrics (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id         UUID          NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  platform_account_id UUID          REFERENCES ad_platform_accounts(id) ON DELETE SET NULL,
  client_id           UUID          REFERENCES agency_clients(id) ON DELETE SET NULL,
  date                DATE          NOT NULL,
  region              TEXT          NOT NULL,
  spend               DECIMAL(12,4) NOT NULL DEFAULT 0,
  leads               INTEGER       NOT NULL DEFAULT 0,
  clicks              INTEGER       NOT NULL DEFAULT 0,
  link_clicks         INTEGER       NOT NULL DEFAULT 0,
  impressions         INTEGER       NOT NULL DEFAULT 0,
  reach               INTEGER       NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS campaign_geo_metrics_unique
  ON campaign_geo_metrics(campaign_id, date, region);

CREATE INDEX IF NOT EXISTS campaign_geo_metrics_campaign_idx
  ON campaign_geo_metrics(campaign_id);

CREATE INDEX IF NOT EXISTS campaign_geo_metrics_date_idx
  ON campaign_geo_metrics(date);

CREATE INDEX IF NOT EXISTS campaign_geo_metrics_user_idx
  ON campaign_geo_metrics(user_id);

DROP TRIGGER IF EXISTS campaign_geo_metrics_updated_at ON campaign_geo_metrics;
CREATE TRIGGER campaign_geo_metrics_updated_at
  BEFORE UPDATE ON campaign_geo_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE campaign_geo_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "geo_metrics_owner" ON campaign_geo_metrics;
CREATE POLICY "geo_metrics_owner" ON campaign_geo_metrics
  USING (auth.uid() = user_id);
