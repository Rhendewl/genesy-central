-- ─────────────────────────────────────────────────────────────────────────────
-- Lancaster SaaS — Migration 004: Módulo de Tráfego Pago
-- ─────────────────────────────────────────────────────────────────────────────
-- Nota: usa agency_clients da migration 003 como base de clientes.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Configurações de Tráfego por Cliente ─────────────────────────────────────
-- Vincula agency_clients ao contexto de tráfego com dados específicos

CREATE TABLE IF NOT EXISTS traffic_client_settings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES agency_clients(id) ON DELETE CASCADE,
  monthly_budget  NUMERIC(12,2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'ativo'
                    CHECK (status IN ('ativo', 'pausado', 'inativo')),
  platforms       TEXT[] NOT NULL DEFAULT '{}',
  max_cpl         NUMERIC(12,2),
  target_leads    INTEGER,
  target_conversions INTEGER,
  min_ctr         NUMERIC(5,2),
  target_roas     NUMERIC(5,2),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, client_id)
);

-- ── Campanhas ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS campaigns (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  platform        TEXT NOT NULL DEFAULT 'meta'
                    CHECK (platform IN ('meta', 'google', 'tiktok', 'linkedin', 'outro')),
  objective       TEXT NOT NULL DEFAULT 'leads'
                    CHECK (objective IN ('leads', 'conversoes', 'alcance', 'trafego', 'engajamento', 'vendas', 'outro')),
  status          TEXT NOT NULL DEFAULT 'ativa'
                    CHECK (status IN ('ativa', 'pausada', 'finalizada', 'em_revisao', 'rascunho')),
  daily_budget    NUMERIC(12,2) DEFAULT 0,
  total_budget    NUMERIC(12,2) DEFAULT 0,
  start_date      DATE NOT NULL,
  end_date        DATE,
  external_id     TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Métricas de Campanha (registros diários/periódicos) ───────────────────────

CREATE TABLE IF NOT EXISTS campaign_metrics (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  date            DATE NOT NULL,
  impressions     INTEGER NOT NULL DEFAULT 0,
  clicks          INTEGER NOT NULL DEFAULT 0,
  spend           NUMERIC(12,2) NOT NULL DEFAULT 0,
  leads           INTEGER NOT NULL DEFAULT 0,
  conversions     INTEGER NOT NULL DEFAULT 0,
  reach           INTEGER NOT NULL DEFAULT 0,
  frequency       NUMERIC(5,2) NOT NULL DEFAULT 0,
  video_views     INTEGER NOT NULL DEFAULT 0,
  -- computed (stored for performance)
  ctr             NUMERIC(8,4) GENERATED ALWAYS AS (
                    CASE WHEN impressions > 0
                    THEN ROUND((clicks::NUMERIC / impressions) * 100, 4)
                    ELSE 0 END
                  ) STORED,
  cpl             NUMERIC(12,2) GENERATED ALWAYS AS (
                    CASE WHEN leads > 0 THEN ROUND(spend / leads, 2) ELSE 0 END
                  ) STORED,
  cpc             NUMERIC(12,2) GENERATED ALWAYS AS (
                    CASE WHEN clicks > 0 THEN ROUND(spend / clicks, 2) ELSE 0 END
                  ) STORED,
  cpm             NUMERIC(12,2) GENERATED ALWAYS AS (
                    CASE WHEN impressions > 0
                    THEN ROUND((spend / impressions) * 1000, 2)
                    ELSE 0 END
                  ) STORED,
  conversion_rate NUMERIC(8,4) GENERATED ALWAYS AS (
                    CASE WHEN leads > 0
                    THEN ROUND((conversions::NUMERIC / leads) * 100, 4)
                    ELSE 0 END
                  ) STORED,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, date)
);

-- ── Contas de Plataforma (integração Meta/Google) ─────────────────────────────

CREATE TABLE IF NOT EXISTS ad_platform_accounts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  platform        TEXT NOT NULL
                    CHECK (platform IN ('meta', 'google', 'tiktok', 'linkedin')),
  account_name    TEXT NOT NULL,
  account_id      TEXT,
  status          TEXT NOT NULL DEFAULT 'connected'
                    CHECK (status IN ('connected', 'disconnected', 'pending', 'error')),
  last_sync_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Metas Mensais de Tráfego por Cliente ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS traffic_monthly_goals (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id            UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  year                 INTEGER NOT NULL,
  month                INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  target_leads         INTEGER NOT NULL DEFAULT 0,
  max_cpl              NUMERIC(12,2) NOT NULL DEFAULT 0,
  target_conversions   INTEGER NOT NULL DEFAULT 0,
  min_ctr              NUMERIC(5,2) NOT NULL DEFAULT 0,
  target_roas          NUMERIC(5,2) NOT NULL DEFAULT 0,
  monthly_budget       NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, client_id, year, month)
);

-- ── Índices ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tcs_user_id         ON traffic_client_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_tcs_client_id        ON traffic_client_settings(client_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id    ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_client_id  ON campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status     ON campaigns(user_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_platform   ON campaigns(platform);
CREATE INDEX IF NOT EXISTS idx_cm_campaign_id       ON campaign_metrics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_cm_date              ON campaign_metrics(date);
CREATE INDEX IF NOT EXISTS idx_cm_user_id           ON campaign_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_cm_client_id         ON campaign_metrics(client_id);
CREATE INDEX IF NOT EXISTS idx_apa_user_id          ON ad_platform_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_tmg_user_month       ON traffic_monthly_goals(user_id, year, month);
CREATE INDEX IF NOT EXISTS idx_tmg_client_month     ON traffic_monthly_goals(user_id, client_id, year, month);

-- ── Triggers updated_at ───────────────────────────────────────────────────────

CREATE TRIGGER update_tcs_updated_at
  BEFORE UPDATE ON traffic_client_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_apa_updated_at
  BEFORE UPDATE ON ad_platform_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_tmg_updated_at
  BEFORE UPDATE ON traffic_monthly_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE traffic_client_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns                ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_metrics         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_platform_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE traffic_monthly_goals    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_traffic_client_settings"
  ON traffic_client_settings FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_campaigns"
  ON campaigns FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_campaign_metrics"
  ON campaign_metrics FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_ad_platform_accounts"
  ON ad_platform_accounts FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_traffic_monthly_goals"
  ON traffic_monthly_goals FOR ALL USING (auth.uid() = user_id);

-- ── Realtime (habilitar no Supabase Dashboard se necessário) ──────────────────
-- ALTER PUBLICATION supabase_realtime ADD TABLE campaign_metrics;
-- ALTER PUBLICATION supabase_realtime ADD TABLE campaigns;
