-- ─────────────────────────────────────────────────────────────────────────────
-- Lancaster SaaS — Migration 003: Módulo Financeiro Completo
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Clientes da Agência (imobiliárias/construtoras atendidas) ─────────────────

CREATE TABLE IF NOT EXISTS agency_clients (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  company_type   TEXT NOT NULL DEFAULT 'imobiliaria'
                   CHECK (company_type IN ('imobiliaria', 'construtora', 'corretor', 'outro')),
  status         TEXT NOT NULL DEFAULT 'ativo'
                   CHECK (status IN ('ativo', 'inativo', 'churned')),
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

-- ── Contratos ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contracts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id   UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  type        TEXT NOT NULL DEFAULT 'mensalidade'
                CHECK (type IN ('mensalidade', 'setup', 'projeto', 'consultoria')),
  value       NUMERIC(12,2) NOT NULL DEFAULT 0,
  start_date  DATE NOT NULL,
  end_date    DATE,
  status      TEXT NOT NULL DEFAULT 'ativo'
                CHECK (status IN ('ativo', 'encerrado', 'pausado')),
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Receitas ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS revenues (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  type            TEXT NOT NULL DEFAULT 'mensalidade'
                    CHECK (type IN ('mensalidade', 'setup', 'extra', 'consultoria', 'outro')),
  description     TEXT NOT NULL,
  amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  date            DATE NOT NULL,
  due_date        DATE,
  paid_date       DATE,
  payment_method  TEXT DEFAULT 'pix'
                    CHECK (payment_method IN ('pix', 'boleto', 'cartao', 'ted', 'dinheiro', 'outro')),
  status          TEXT NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pago', 'pendente', 'atrasado', 'cancelado')),
  is_recurring    BOOLEAN NOT NULL DEFAULT FALSE,
  recurring_id    UUID,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Despesas ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS expenses (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id     UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  category      TEXT NOT NULL DEFAULT 'outros'
                  CHECK (category IN (
                    'freelancers', 'equipe', 'ferramentas', 'impostos',
                    'operacional', 'marketing', 'trafego_pago', 'outros'
                  )),
  description   TEXT NOT NULL,
  amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  date          DATE NOT NULL,
  type          TEXT NOT NULL DEFAULT 'variavel'
                  CHECK (type IN ('fixa', 'variavel')),
  cost_center   TEXT,
  auto_imported BOOLEAN NOT NULL DEFAULT FALSE,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Receitas Recorrentes (setup) ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recurring_revenues (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id           UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  type                TEXT NOT NULL DEFAULT 'mensalidade'
                        CHECK (type IN ('mensalidade', 'setup', 'extra', 'consultoria', 'outro')),
  description         TEXT NOT NULL,
  amount              NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_day         INTEGER DEFAULT 10 CHECK (payment_day BETWEEN 1 AND 31),
  status              TEXT NOT NULL DEFAULT 'ativo'
                        CHECK (status IN ('ativo', 'pausado', 'cancelado')),
  start_date          DATE NOT NULL,
  end_date            DATE,
  last_generated_date DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Custos de Tráfego (auto-importados do módulo de tráfego) ──────────────────

CREATE TABLE IF NOT EXISTS traffic_costs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  campaign_name   TEXT NOT NULL DEFAULT 'Tráfego Pago',
  platform        TEXT NOT NULL DEFAULT 'meta'
                    CHECK (platform IN ('meta', 'google', 'tiktok', 'linkedin', 'outro')),
  amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  date            DATE NOT NULL,
  period_start    DATE,
  period_end      DATE,
  reference_id    UUID,
  imported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Metas Financeiras ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS financial_goals (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year                INTEGER NOT NULL,
  month               INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  revenue_goal        NUMERIC(12,2) DEFAULT 0,
  profit_goal         NUMERIC(12,2) DEFAULT 0,
  mrr_goal            NUMERIC(12,2) DEFAULT 0,
  new_contracts_goal  INTEGER DEFAULT 0,
  margin_goal         NUMERIC(5,2) DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, year, month)
);

-- ── Inadimplência / Cobranças ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS collections (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id         UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  revenue_id        UUID REFERENCES revenues(id) ON DELETE SET NULL,
  amount            NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date          DATE NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pendente'
                      CHECK (status IN ('pendente', 'em_cobranca', 'pago', 'perdido')),
  last_contact_date DATE,
  contact_notes     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Índices ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_agency_clients_user_id  ON agency_clients(user_id);
CREATE INDEX IF NOT EXISTS idx_agency_clients_status   ON agency_clients(user_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_user_id       ON contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_client_id     ON contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_revenues_user_id        ON revenues(user_id);
CREATE INDEX IF NOT EXISTS idx_revenues_client_id      ON revenues(client_id);
CREATE INDEX IF NOT EXISTS idx_revenues_date           ON revenues(date);
CREATE INDEX IF NOT EXISTS idx_revenues_status         ON revenues(status);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id        ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date           ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category       ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_traffic_costs_user_id   ON traffic_costs(user_id);
CREATE INDEX IF NOT EXISTS idx_traffic_costs_date      ON traffic_costs(date);
CREATE INDEX IF NOT EXISTS idx_financial_goals_month   ON financial_goals(user_id, year, month);
CREATE INDEX IF NOT EXISTS idx_collections_user_id     ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_status      ON collections(user_id, status);

-- ── Triggers updated_at ───────────────────────────────────────────────────────

CREATE TRIGGER update_agency_clients_updated_at
  BEFORE UPDATE ON agency_clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_revenues_updated_at
  BEFORE UPDATE ON revenues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_recurring_revenues_updated_at
  BEFORE UPDATE ON recurring_revenues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_financial_goals_updated_at
  BEFORE UPDATE ON financial_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON collections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE agency_clients      ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenues            ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_revenues  ENABLE ROW LEVEL SECURITY;
ALTER TABLE traffic_costs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_goals     ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_agency_clients"
  ON agency_clients FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_contracts"
  ON contracts FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_revenues"
  ON revenues FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_expenses"
  ON expenses FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_recurring_revenues"
  ON recurring_revenues FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_traffic_costs"
  ON traffic_costs FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_financial_goals"
  ON financial_goals FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_collections"
  ON collections FOR ALL USING (auth.uid() = user_id);

-- ── Realtime (habilitar no Supabase Dashboard) ────────────────────────────────
-- ALTER PUBLICATION supabase_realtime ADD TABLE agency_clients;
-- ALTER PUBLICATION supabase_realtime ADD TABLE revenues;
-- ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
-- ALTER PUBLICATION supabase_realtime ADD TABLE collections;
