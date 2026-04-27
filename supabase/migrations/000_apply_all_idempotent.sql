-- =============================================================================
-- Lancaster SaaS — Schema completo (idempotente, pode rodar várias vezes)
-- Copie TUDO e cole no Supabase > SQL Editor > New query > Run
-- =============================================================================

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TAGS
-- =============================================================================
CREATE TABLE IF NOT EXISTS tags (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#7d99ad',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tags: user owns rows" ON tags;
CREATE POLICY "tags: user owns rows"
  ON tags FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- LEADS
-- =============================================================================
CREATE TABLE IF NOT EXISTS leads (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  contact       TEXT NOT NULL,
  kanban_column TEXT NOT NULL DEFAULT 'abordados'
                  CHECK (kanban_column IN (
                    'abordados','em_andamento','formulario_aplicado',
                    'reuniao_agendada','reuniao_realizada','no_show','venda_realizada'
                  )),
  tags          UUID[] NOT NULL DEFAULT '{}',
  notes         TEXT,
  deal_value    NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (deal_value >= 0),
  entered_at    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leads: user owns rows" ON leads;
CREATE POLICY "leads: user owns rows"
  ON leads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_updated_at ON leads;
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- =============================================================================
-- LEAD MOVEMENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS lead_movements (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  from_column TEXT NOT NULL,
  to_column   TEXT NOT NULL,
  moved_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE lead_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lead_movements: user owns via lead" ON lead_movements;
CREATE POLICY "lead_movements: user owns via lead"
  ON lead_movements FOR ALL
  USING (EXISTS (
    SELECT 1 FROM leads l WHERE l.id = lead_movements.lead_id AND l.user_id = auth.uid()
  ));

-- =============================================================================
-- CATEGORIES
-- =============================================================================
CREATE TABLE IF NOT EXISTS categories (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#7d99ad',
  type       TEXT NOT NULL DEFAULT 'ambos' CHECK (type IN ('receita','despesa','ambos')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "categories: user owns rows" ON categories;
CREATE POLICY "categories: user owns rows"
  ON categories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- LANÇAMENTOS
-- =============================================================================
CREATE TABLE IF NOT EXISTS lancamentos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('receita','despesa')),
  description TEXT NOT NULL,
  amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  notes       TEXT,
  source      TEXT DEFAULT 'manual'
                CHECK (source IN ('manual','trafego_investimento','trafego_venda','crm_venda')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lancamentos: user owns rows" ON lancamentos;
CREATE POLICY "lancamentos: user owns rows"
  ON lancamentos FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- CLIENTES RECORRENTES
-- =============================================================================
CREATE TABLE IF NOT EXISTS clientes_recorrentes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  monthly_value NUMERIC(12,2) NOT NULL CHECK (monthly_value > 0),
  start_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  status        TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE clientes_recorrentes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clientes_recorrentes: user owns rows" ON clientes_recorrentes;
CREATE POLICY "clientes_recorrentes: user owns rows"
  ON clientes_recorrentes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- INVESTIMENTOS DIÁRIOS
-- =============================================================================
CREATE TABLE IF NOT EXISTS investimentos_diarios (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  amount_invested  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount_invested >= 0),
  followers_gained INTEGER NOT NULL DEFAULT 0,
  reach            INTEGER NOT NULL DEFAULT 0,
  messages         INTEGER NOT NULL DEFAULT 0,
  meetings         INTEGER NOT NULL DEFAULT 0,
  amount_sold      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount_sold >= 0),
  recurring_value  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (recurring_value >= 0),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);
ALTER TABLE investimentos_diarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "investimentos_diarios: user owns rows" ON investimentos_diarios;
CREATE POLICY "investimentos_diarios: user owns rows"
  ON investimentos_diarios FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS investimentos_diarios_updated_at ON investimentos_diarios;
CREATE TRIGGER investimentos_diarios_updated_at
  BEFORE UPDATE ON investimentos_diarios FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- =============================================================================
-- TRIGGER: seed tags + categories no primeiro login
-- =============================================================================
CREATE OR REPLACE FUNCTION on_auth_user_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO tags (user_id, name, color) VALUES
    (NEW.id, 'Tráfego Pago',        '#7d99ad'),
    (NEW.id, 'Social',              '#5b87a0'),
    (NEW.id, 'Indicação',           '#4a7a95'),
    (NEW.id, 'Corretor',            '#3d6d88'),
    (NEW.id, 'Dono de Imobiliária', '#22c55e');

  INSERT INTO categories (user_id, name, color, type) VALUES
    (NEW.id, 'Tráfego Pago', '#ef4444', 'despesa'),
    (NEW.id, 'Vendas',       '#22c55e', 'receita'),
    (NEW.id, 'Recorrência',  '#10b981', 'receita'),
    (NEW.id, 'Operacional',  '#f59e0b', 'despesa'),
    (NEW.id, 'Marketing',    '#7d99ad', 'ambos');

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE on_auth_user_created();

-- =============================================================================
-- MÓDULO FINANCEIRO
-- =============================================================================

-- ── Clientes da Agência ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agency_clients (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  company_type   TEXT NOT NULL DEFAULT 'imobiliaria'
                   CHECK (company_type IN ('imobiliaria','construtora','corretor','outro')),
  status         TEXT NOT NULL DEFAULT 'ativo'
                   CHECK (status IN ('ativo','inativo','churned')),
  monthly_fee    NUMERIC(12,2) NOT NULL DEFAULT 0,
  contract_start DATE,
  contract_end   DATE,
  payment_day    INTEGER DEFAULT 10 CHECK (payment_day BETWEEN 1 AND 31),
  contact_name   TEXT,
  contact_email  TEXT,
  contact_phone  TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE agency_clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_agency_clients" ON agency_clients;
CREATE POLICY "users_own_agency_clients"
  ON agency_clients FOR ALL USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_agency_clients_updated_at ON agency_clients;
CREATE TRIGGER update_agency_clients_updated_at
  BEFORE UPDATE ON agency_clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Contratos ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contracts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id   UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  type        TEXT NOT NULL DEFAULT 'mensalidade'
                CHECK (type IN ('mensalidade','setup','projeto','consultoria')),
  value       NUMERIC(12,2) NOT NULL DEFAULT 0,
  start_date  DATE NOT NULL,
  end_date    DATE,
  status      TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','encerrado','pausado')),
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_contracts" ON contracts;
CREATE POLICY "users_own_contracts"
  ON contracts FOR ALL USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_contracts_updated_at ON contracts;
CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Receitas ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS revenues (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id      UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  type           TEXT NOT NULL DEFAULT 'mensalidade'
                   CHECK (type IN ('mensalidade','setup','extra','consultoria','outro')),
  description    TEXT NOT NULL,
  amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  date           DATE NOT NULL,
  due_date       DATE,
  paid_date      DATE,
  payment_method TEXT DEFAULT 'pix'
                   CHECK (payment_method IN ('pix','boleto','cartao','ted','dinheiro','outro')),
  status         TEXT NOT NULL DEFAULT 'pendente'
                   CHECK (status IN ('pago','pendente','atrasado','cancelado')),
  is_recurring   BOOLEAN NOT NULL DEFAULT FALSE,
  recurring_id   UUID,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE revenues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_revenues" ON revenues;
CREATE POLICY "users_own_revenues"
  ON revenues FOR ALL USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_revenues_updated_at ON revenues;
CREATE TRIGGER update_revenues_updated_at
  BEFORE UPDATE ON revenues FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Despesas ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id     UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  category      TEXT NOT NULL DEFAULT 'outros'
                  CHECK (category IN (
                    'freelancers','equipe','ferramentas','impostos',
                    'operacional','marketing','trafego_pago','outros'
                  )),
  description   TEXT NOT NULL,
  amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  date          DATE NOT NULL,
  type          TEXT NOT NULL DEFAULT 'variavel' CHECK (type IN ('fixa','variavel')),
  cost_center   TEXT,
  auto_imported BOOLEAN NOT NULL DEFAULT FALSE,
  external_ref  TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_expenses" ON expenses;
CREATE POLICY "users_own_expenses"
  ON expenses FOR ALL USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_external_ref
  ON expenses(user_id, external_ref) WHERE external_ref IS NOT NULL;

-- ── Receitas Recorrentes ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recurring_revenues (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id           UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  type                TEXT NOT NULL DEFAULT 'mensalidade'
                        CHECK (type IN ('mensalidade','setup','extra','consultoria','outro')),
  description         TEXT NOT NULL,
  amount              NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_day         INTEGER DEFAULT 10 CHECK (payment_day BETWEEN 1 AND 31),
  status              TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','pausado','cancelado')),
  start_date          DATE NOT NULL,
  end_date            DATE,
  last_generated_date DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE recurring_revenues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_recurring_revenues" ON recurring_revenues;
CREATE POLICY "users_own_recurring_revenues"
  ON recurring_revenues FOR ALL USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_recurring_revenues_updated_at ON recurring_revenues;
CREATE TRIGGER update_recurring_revenues_updated_at
  BEFORE UPDATE ON recurring_revenues FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Custos de Tráfego ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS traffic_costs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id     UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  campaign_name TEXT NOT NULL DEFAULT 'Tráfego Pago',
  platform      TEXT NOT NULL DEFAULT 'meta'
                  CHECK (platform IN ('meta','google','tiktok','linkedin','outro')),
  amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  date          DATE NOT NULL,
  period_start  DATE,
  period_end    DATE,
  reference_id  UUID,
  external_ref  TEXT,
  imported_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE traffic_costs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_traffic_costs" ON traffic_costs;
CREATE POLICY "users_own_traffic_costs"
  ON traffic_costs FOR ALL USING (auth.uid() = user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_traffic_costs_external_ref
  ON traffic_costs(user_id, external_ref) WHERE external_ref IS NOT NULL;

-- ── Metas Financeiras ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS financial_goals (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year               INTEGER NOT NULL,
  month              INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  revenue_goal       NUMERIC(12,2) DEFAULT 0,
  profit_goal        NUMERIC(12,2) DEFAULT 0,
  mrr_goal           NUMERIC(12,2) DEFAULT 0,
  new_contracts_goal INTEGER DEFAULT 0,
  margin_goal        NUMERIC(5,2) DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, year, month)
);
ALTER TABLE financial_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_financial_goals" ON financial_goals;
CREATE POLICY "users_own_financial_goals"
  ON financial_goals FOR ALL USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_financial_goals_updated_at ON financial_goals;
CREATE TRIGGER update_financial_goals_updated_at
  BEFORE UPDATE ON financial_goals FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Inadimplência ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS collections (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id         UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  revenue_id        UUID REFERENCES revenues(id) ON DELETE SET NULL,
  amount            NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date          DATE NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pendente'
                      CHECK (status IN ('pendente','em_cobranca','pago','perdido')),
  last_contact_date DATE,
  contact_notes     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_collections" ON collections;
CREATE POLICY "users_own_collections"
  ON collections FOR ALL USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_collections_updated_at ON collections;
CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON collections FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Índices financeiros ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_agency_clients_user_id ON agency_clients(user_id);
CREATE INDEX IF NOT EXISTS idx_agency_clients_status  ON agency_clients(user_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_user_id      ON contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_client_id    ON contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_revenues_user_id       ON revenues(user_id);
CREATE INDEX IF NOT EXISTS idx_revenues_client_id     ON revenues(client_id);
CREATE INDEX IF NOT EXISTS idx_revenues_date          ON revenues(date);
CREATE INDEX IF NOT EXISTS idx_revenues_status        ON revenues(status);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id       ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date          ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category      ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_traffic_costs_user_id  ON traffic_costs(user_id);
CREATE INDEX IF NOT EXISTS idx_traffic_costs_date     ON traffic_costs(date);
CREATE INDEX IF NOT EXISTS idx_financial_goals_month  ON financial_goals(user_id, year, month);
CREATE INDEX IF NOT EXISTS idx_collections_user_id    ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_status     ON collections(user_id, status);

-- =============================================================================
-- MÓDULO DE TRÁFEGO
-- =============================================================================

-- ── Configurações de Tráfego por Cliente ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS traffic_client_settings (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id          UUID NOT NULL REFERENCES agency_clients(id) ON DELETE CASCADE,
  monthly_budget     NUMERIC(12,2) NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','pausado','inativo')),
  platforms          TEXT[] NOT NULL DEFAULT '{}',
  max_cpl            NUMERIC(12,2),
  target_leads       INTEGER,
  target_conversions INTEGER,
  min_ctr            NUMERIC(5,2),
  target_roas        NUMERIC(5,2),
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, client_id)
);
ALTER TABLE traffic_client_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_traffic_client_settings" ON traffic_client_settings;
CREATE POLICY "users_own_traffic_client_settings"
  ON traffic_client_settings FOR ALL USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_tcs_updated_at ON traffic_client_settings;
CREATE TRIGGER update_tcs_updated_at
  BEFORE UPDATE ON traffic_client_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Campanhas ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id            UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  platform_account_id  UUID,  -- FK adicionado via ALTER abaixo (após ad_platform_accounts)
  name                 TEXT NOT NULL,
  platform             TEXT NOT NULL DEFAULT 'meta'
                         CHECK (platform IN ('meta','google','tiktok','linkedin','outro')),
  objective            TEXT NOT NULL DEFAULT 'leads'
                         CHECK (objective IN ('leads','conversoes','alcance','trafego','engajamento','vendas','outro')),
  status               TEXT NOT NULL DEFAULT 'ativa'
                         CHECK (status IN ('ativa','pausada','finalizada','em_revisao','rascunho')),
  daily_budget         NUMERIC(12,2) DEFAULT 0,
  total_budget         NUMERIC(12,2) DEFAULT 0,
  start_date           DATE NOT NULL,
  end_date             DATE,
  external_id          TEXT,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_campaigns" ON campaigns;
CREATE POLICY "users_own_campaigns"
  ON campaigns FOR ALL USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Métricas de Campanha ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_metrics (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id          UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  client_id            UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  platform_account_id  UUID,  -- FK adicionado via ALTER abaixo (após ad_platform_accounts)
  date                 DATE NOT NULL,
  impressions          INTEGER NOT NULL DEFAULT 0,
  clicks               INTEGER NOT NULL DEFAULT 0,
  link_clicks          INTEGER NOT NULL DEFAULT 0,
  spend                NUMERIC(12,2) NOT NULL DEFAULT 0,
  leads                INTEGER NOT NULL DEFAULT 0,
  conversions          INTEGER NOT NULL DEFAULT 0,
  reach                INTEGER NOT NULL DEFAULT 0,
  frequency            NUMERIC(5,2) NOT NULL DEFAULT 0,
  unique_ctr           NUMERIC(8,4) NOT NULL DEFAULT 0,
  video_views          INTEGER NOT NULL DEFAULT 0,
  ctr                  NUMERIC(8,4) GENERATED ALWAYS AS (
                         CASE WHEN impressions > 0 THEN ROUND((clicks::NUMERIC / impressions) * 100, 4) ELSE 0 END
                       ) STORED,
  cpl                  NUMERIC(12,2) GENERATED ALWAYS AS (
                         CASE WHEN leads > 0 THEN ROUND(spend / leads, 2) ELSE 0 END
                       ) STORED,
  cpc                  NUMERIC(12,2) GENERATED ALWAYS AS (
                         CASE WHEN clicks > 0 THEN ROUND(spend / clicks, 2) ELSE 0 END
                       ) STORED,
  cpm                  NUMERIC(12,2) GENERATED ALWAYS AS (
                         CASE WHEN impressions > 0 THEN ROUND((spend / impressions) * 1000, 2) ELSE 0 END
                       ) STORED,
  conversion_rate      NUMERIC(8,4) GENERATED ALWAYS AS (
                         CASE WHEN leads > 0 THEN ROUND((conversions::NUMERIC / leads) * 100, 4) ELSE 0 END
                       ) STORED,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, date)
);
ALTER TABLE campaign_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_campaign_metrics" ON campaign_metrics;
CREATE POLICY "users_own_campaign_metrics"
  ON campaign_metrics FOR ALL USING (auth.uid() = user_id);

-- ── Contas de Plataforma ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ad_platform_accounts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id    UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  platform     TEXT NOT NULL CHECK (platform IN ('meta','google','tiktok','linkedin')),
  account_name TEXT NOT NULL,
  account_id   TEXT,
  status       TEXT NOT NULL DEFAULT 'connected'
                 CHECK (status IN ('connected','disconnected','pending','error')),
  last_sync_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE ad_platform_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_ad_platform_accounts" ON ad_platform_accounts;
CREATE POLICY "users_own_ad_platform_accounts"
  ON ad_platform_accounts FOR ALL USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_apa_updated_at ON ad_platform_accounts;
CREATE TRIGGER update_apa_updated_at
  BEFORE UPDATE ON ad_platform_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE UNIQUE INDEX IF NOT EXISTS idx_apa_unique_user_platform_account
  ON ad_platform_accounts(user_id, platform, account_id) WHERE account_id IS NOT NULL;

-- ── Metas Mensais de Tráfego ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS traffic_monthly_goals (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id          UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  year               INTEGER NOT NULL,
  month              INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  target_leads       INTEGER NOT NULL DEFAULT 0,
  max_cpl            NUMERIC(12,2) NOT NULL DEFAULT 0,
  target_conversions INTEGER NOT NULL DEFAULT 0,
  min_ctr            NUMERIC(5,2) NOT NULL DEFAULT 0,
  target_roas        NUMERIC(5,2) NOT NULL DEFAULT 0,
  monthly_budget     NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, client_id, year, month)
);
ALTER TABLE traffic_monthly_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_traffic_monthly_goals" ON traffic_monthly_goals;
CREATE POLICY "users_own_traffic_monthly_goals"
  ON traffic_monthly_goals FOR ALL USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_tmg_updated_at ON traffic_monthly_goals;
CREATE TRIGGER update_tmg_updated_at
  BEFORE UPDATE ON traffic_monthly_goals FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Índices de tráfego ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tcs_user_id        ON traffic_client_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_tcs_client_id       ON traffic_client_settings(client_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id   ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_client_id ON campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status    ON campaigns(user_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_platform  ON campaigns(platform);
CREATE INDEX IF NOT EXISTS idx_cm_campaign_id      ON campaign_metrics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_cm_date             ON campaign_metrics(date);
CREATE INDEX IF NOT EXISTS idx_cm_user_id          ON campaign_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_cm_client_id        ON campaign_metrics(client_id);
CREATE INDEX IF NOT EXISTS idx_apa_user_id         ON ad_platform_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_tmg_user_month      ON traffic_monthly_goals(user_id, year, month);
CREATE INDEX IF NOT EXISTS idx_tmg_client_month    ON traffic_monthly_goals(user_id, client_id, year, month);

-- =============================================================================
-- INTEGRAÇÃO META ADS
-- =============================================================================

-- ── Tokens OAuth ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meta_tokens (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_account_id UUID REFERENCES ad_platform_accounts(id) ON DELETE CASCADE,
  encrypted_token     TEXT NOT NULL DEFAULT '',
  token_expires_at    TIMESTAMPTZ,
  ad_accounts         JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE meta_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_meta_tokens" ON meta_tokens;
CREATE POLICY "users_own_meta_tokens"
  ON meta_tokens FOR ALL USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_meta_tokens_updated_at ON meta_tokens;
CREATE TRIGGER update_meta_tokens_updated_at
  BEFORE UPDATE ON meta_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Logs de Sincronização ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meta_sync_logs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_account_id UUID REFERENCES ad_platform_accounts(id) ON DELETE SET NULL,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at         TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'running'
                        CHECK (status IN ('running','success','error')),
  campaigns_synced    INT NOT NULL DEFAULT 0,
  metrics_synced      INT NOT NULL DEFAULT 0,
  error_message       TEXT
);
ALTER TABLE meta_sync_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_meta_sync_logs" ON meta_sync_logs;
CREATE POLICY "users_own_meta_sync_logs"
  ON meta_sync_logs FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_meta_tokens_user_id             ON meta_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_meta_tokens_platform_account_id ON meta_tokens(platform_account_id);
CREATE INDEX IF NOT EXISTS idx_meta_sync_logs_user_id          ON meta_sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_meta_sync_logs_started_at       ON meta_sync_logs(started_at DESC);

-- =============================================================================
-- MULTI-CONTA META ADS (migrations 008 + 009)
-- FKs adicionadas após ad_platform_accounts existir (dependência circular evitada)
-- =============================================================================

-- Novas colunas — idempotentes
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS platform_account_id UUID
    REFERENCES ad_platform_accounts(id) ON DELETE SET NULL;

ALTER TABLE campaign_metrics
  ADD COLUMN IF NOT EXISTS link_clicks         INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unique_ctr          NUMERIC(8,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_account_id UUID
    REFERENCES ad_platform_accounts(id) ON DELETE SET NULL;

-- Índices para as novas colunas
CREATE INDEX IF NOT EXISTS idx_campaigns_platform_account_id ON campaigns(platform_account_id);
CREATE INDEX IF NOT EXISTS idx_cm_platform_account_id        ON campaign_metrics(platform_account_id);
CREATE INDEX IF NOT EXISTS idx_cm_user_account_date          ON campaign_metrics(user_id, platform_account_id, date);
CREATE INDEX IF NOT EXISTS idx_cm_link_clicks                ON campaign_metrics(campaign_id, date) WHERE link_clicks > 0;

-- =============================================================================
-- CLIENT COST SHARES (migration 015)
-- Comissões / custos variáveis de parceiros vinculados a um cliente.
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
