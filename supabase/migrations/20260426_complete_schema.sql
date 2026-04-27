-- ═══════════════════════════════════════════════════════════════════════════
-- LANCASTER SAAS — MIGRATION COMPLETA
-- Gerada em: 2026-04-26
-- Segura para executar em banco existente:
--   • CREATE TABLE IF NOT EXISTS
--   • ADD COLUMN IF NOT EXISTS
--   • DROP POLICY IF EXISTS + CREATE POLICY
--   • DROP INDEX IF EXISTS / CREATE INDEX IF NOT EXISTS
--   • Nenhum DROP TABLE ou DROP COLUMN
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCO 0 — Helper: updated_at automático
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Helper para criar trigger de updated_at idempotente
CREATE OR REPLACE FUNCTION public.ensure_updated_at_trigger(tbl text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format(
    'DROP TRIGGER IF EXISTS %I ON public.%I;
     CREATE TRIGGER %I
       BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
    tbl || '_updated_at', tbl,
    tbl || '_updated_at', tbl
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOCO 1 — MÓDULO CLIENTES
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1.1 agency_clients ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agency_clients (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text        NOT NULL,
  company_type   text        NOT NULL DEFAULT 'outro'
                             CHECK (company_type IN ('imobiliaria','construtora','corretor','outro')),
  status         text        NOT NULL DEFAULT 'ativo'
                             CHECK (status IN ('ativo','inativo','churned')),
  monthly_fee    numeric(12,2) NOT NULL DEFAULT 0,
  contract_start date,
  contract_end   date,
  payment_day    smallint    NOT NULL DEFAULT 10 CHECK (payment_day BETWEEN 1 AND 31),
  contact_name   text,
  contact_email  text,
  contact_phone  text,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Garantir colunas caso a tabela já exista sem algumas delas
ALTER TABLE public.agency_clients
  ADD COLUMN IF NOT EXISTS company_type   text        NOT NULL DEFAULT 'outro',
  ADD COLUMN IF NOT EXISTS status         text        NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS monthly_fee    numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contract_start date,
  ADD COLUMN IF NOT EXISTS contract_end   date,
  ADD COLUMN IF NOT EXISTS payment_day    smallint    NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS contact_name   text,
  ADD COLUMN IF NOT EXISTS contact_email  text,
  ADD COLUMN IF NOT EXISTS contact_phone  text,
  ADD COLUMN IF NOT EXISTS notes          text,
  ADD COLUMN IF NOT EXISTS updated_at     timestamptz NOT NULL DEFAULT now();

-- CHECK constraints (idempotente via DO)
DO $$ BEGIN
  ALTER TABLE public.agency_clients
    ADD CONSTRAINT agency_clients_company_type_chk
    CHECK (company_type IN ('imobiliaria','construtora','corretor','outro'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.agency_clients
    ADD CONSTRAINT agency_clients_status_chk
    CHECK (status IN ('ativo','inativo','churned'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.agency_clients
    ADD CONSTRAINT agency_clients_payment_day_chk
    CHECK (payment_day BETWEEN 1 AND 31);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

SELECT public.ensure_updated_at_trigger('agency_clients');


-- ── 1.2 client_cost_shares ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.client_cost_shares (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id   uuid        NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  percentage  numeric(5,2) NOT NULL DEFAULT 0 CHECK (percentage >= 0 AND percentage <= 100),
  share_type  text        NOT NULL DEFAULT 'comissao'
              CHECK (share_type IN ('comissao','socio','outro')),
  is_recurring boolean   NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_cost_shares
  ADD COLUMN IF NOT EXISTS share_type   text    NOT NULL DEFAULT 'comissao',
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at   timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE public.client_cost_shares
    ADD CONSTRAINT client_cost_shares_pct_chk
    CHECK (percentage >= 0 AND percentage <= 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.client_cost_shares
    ADD CONSTRAINT client_cost_shares_type_chk
    CHECK (share_type IN ('comissao','socio','outro'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

SELECT public.ensure_updated_at_trigger('client_cost_shares');


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOCO 2 — MÓDULO FINANCEIRO
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 2.1 revenues ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.revenues (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id       uuid        REFERENCES public.agency_clients(id) ON DELETE SET NULL,
  type            text        NOT NULL DEFAULT 'mensalidade'
                              CHECK (type IN ('mensalidade','setup','extra','consultoria','outro')),
  description     text        NOT NULL,
  amount          numeric(12,2) NOT NULL CHECK (amount >= 0),
  date            date        NOT NULL,
  due_date        date,
  paid_date       date,
  payment_method  text        NOT NULL DEFAULT 'pix'
                              CHECK (payment_method IN ('pix','boleto','cartao','ted','dinheiro','outro')),
  status          text        NOT NULL DEFAULT 'pendente'
                              CHECK (status IN ('pago','pendente','atrasado','cancelado')),
  is_recurring    boolean     NOT NULL DEFAULT false,
  recurring_id    uuid,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.revenues
  ADD COLUMN IF NOT EXISTS client_id      uuid        REFERENCES public.agency_clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS type           text        NOT NULL DEFAULT 'mensalidade',
  ADD COLUMN IF NOT EXISTS due_date       date,
  ADD COLUMN IF NOT EXISTS paid_date      date,
  ADD COLUMN IF NOT EXISTS payment_method text        NOT NULL DEFAULT 'pix',
  ADD COLUMN IF NOT EXISTS status         text        NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS is_recurring   boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurring_id   uuid,
  ADD COLUMN IF NOT EXISTS notes          text,
  ADD COLUMN IF NOT EXISTS updated_at     timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE public.revenues ADD CONSTRAINT revenues_type_chk
    CHECK (type IN ('mensalidade','setup','extra','consultoria','outro'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.revenues ADD CONSTRAINT revenues_payment_method_chk
    CHECK (payment_method IN ('pix','boleto','cartao','ted','dinheiro','outro'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.revenues ADD CONSTRAINT revenues_status_chk
    CHECK (status IN ('pago','pendente','atrasado','cancelado'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.revenues ADD CONSTRAINT revenues_amount_chk CHECK (amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

SELECT public.ensure_updated_at_trigger('revenues');


-- ── 2.2 expenses ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.expenses (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id     uuid        REFERENCES public.agency_clients(id) ON DELETE SET NULL,
  category      text        NOT NULL DEFAULT 'outros'
                            CHECK (category IN ('freelancers','equipe','ferramentas','impostos','operacional','marketing','trafego_pago','outros')),
  description   text        NOT NULL,
  amount        numeric(12,2) NOT NULL CHECK (amount >= 0),
  date          date        NOT NULL,
  type          text        NOT NULL DEFAULT 'variavel'
                            CHECK (type IN ('fixa','variavel')),
  cost_center   text,
  auto_imported boolean     NOT NULL DEFAULT false,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS client_id     uuid     REFERENCES public.agency_clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category      text     NOT NULL DEFAULT 'outros',
  ADD COLUMN IF NOT EXISTS type          text     NOT NULL DEFAULT 'variavel',
  ADD COLUMN IF NOT EXISTS cost_center   text,
  ADD COLUMN IF NOT EXISTS auto_imported boolean  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes         text,
  ADD COLUMN IF NOT EXISTS updated_at    timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE public.expenses ADD CONSTRAINT expenses_category_chk
    CHECK (category IN ('freelancers','equipe','ferramentas','impostos','operacional','marketing','trafego_pago','outros'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.expenses ADD CONSTRAINT expenses_type_chk
    CHECK (type IN ('fixa','variavel'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.expenses ADD CONSTRAINT expenses_amount_chk CHECK (amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

SELECT public.ensure_updated_at_trigger('expenses');


-- ── 2.3 collections (Cobranças / Inadimplência) ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.collections (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id         uuid        REFERENCES public.agency_clients(id) ON DELETE SET NULL,
  revenue_id        uuid        REFERENCES public.revenues(id) ON DELETE SET NULL,
  amount            numeric(12,2) NOT NULL CHECK (amount >= 0),
  due_date          date        NOT NULL,
  status            text        NOT NULL DEFAULT 'pendente'
                                CHECK (status IN ('pendente','em_cobranca','pago','perdido')),
  last_contact_date date,
  contact_notes     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS client_id         uuid  REFERENCES public.agency_clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revenue_id        uuid  REFERENCES public.revenues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_contact_date date,
  ADD COLUMN IF NOT EXISTS contact_notes     text,
  ADD COLUMN IF NOT EXISTS updated_at        timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE public.collections ADD CONSTRAINT collections_status_chk
    CHECK (status IN ('pendente','em_cobranca','pago','perdido'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.collections ADD CONSTRAINT collections_amount_chk CHECK (amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

SELECT public.ensure_updated_at_trigger('collections');


-- ── 2.4 financial_goals ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.financial_goals (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year                smallint    NOT NULL,
  month               smallint    NOT NULL CHECK (month BETWEEN 1 AND 12),
  revenue_goal        numeric(12,2) NOT NULL DEFAULT 0,
  profit_goal         numeric(12,2) NOT NULL DEFAULT 0,
  mrr_goal            numeric(12,2) NOT NULL DEFAULT 0,
  new_contracts_goal  integer     NOT NULL DEFAULT 0,
  margin_goal         numeric(5,2) NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, year, month)
);

ALTER TABLE public.financial_goals
  ADD COLUMN IF NOT EXISTS mrr_goal           numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS new_contracts_goal integer       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS margin_goal        numeric(5,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at         timestamptz   NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE public.financial_goals ADD CONSTRAINT financial_goals_month_chk
    CHECK (month BETWEEN 1 AND 12);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.financial_goals ADD UNIQUE (user_id, year, month);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

SELECT public.ensure_updated_at_trigger('financial_goals');


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOCO 3 — MÓDULO TRÁFEGO PAGO
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 3.1 ad_platform_accounts ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ad_platform_accounts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id    uuid        REFERENCES public.agency_clients(id) ON DELETE SET NULL,
  platform     text        NOT NULL CHECK (platform IN ('meta','google','tiktok','linkedin','outro')),
  account_name text        NOT NULL,
  account_id   text,
  status       text        NOT NULL DEFAULT 'pending'
               CHECK (status IN ('connected','disconnected','pending','error')),
  last_sync_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ad_platform_accounts
  ADD COLUMN IF NOT EXISTS client_id    uuid  REFERENCES public.agency_clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at   timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE public.ad_platform_accounts ADD CONSTRAINT ad_platform_accounts_platform_chk
    CHECK (platform IN ('meta','google','tiktok','linkedin','outro'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.ad_platform_accounts ADD CONSTRAINT ad_platform_accounts_status_chk
    CHECK (status IN ('connected','disconnected','pending','error'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

SELECT public.ensure_updated_at_trigger('ad_platform_accounts');


-- ── 3.2 campaigns ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.campaigns (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id           uuid        REFERENCES public.agency_clients(id) ON DELETE SET NULL,
  platform_account_id uuid        REFERENCES public.ad_platform_accounts(id) ON DELETE SET NULL,
  name                text        NOT NULL,
  platform            text        NOT NULL CHECK (platform IN ('meta','google','tiktok','linkedin','outro')),
  objective           text        NOT NULL DEFAULT 'leads'
                      CHECK (objective IN ('leads','conversoes','alcance','trafego','engajamento','vendas','outro')),
  status              text        NOT NULL DEFAULT 'ativa'
                      CHECK (status IN ('ativa','pausada','finalizada','em_revisao','rascunho')),
  daily_budget        numeric(12,2) NOT NULL DEFAULT 0,
  total_budget        numeric(12,2) NOT NULL DEFAULT 0,
  start_date          date        NOT NULL,
  end_date            date,
  external_id         text,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS platform_account_id uuid REFERENCES public.ad_platform_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS objective           text NOT NULL DEFAULT 'leads',
  ADD COLUMN IF NOT EXISTS daily_budget        numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_budget        numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS external_id         text,
  ADD COLUMN IF NOT EXISTS notes               text,
  ADD COLUMN IF NOT EXISTS updated_at          timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_platform_chk
    CHECK (platform IN ('meta','google','tiktok','linkedin','outro'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_status_chk
    CHECK (status IN ('ativa','pausada','finalizada','em_revisao','rascunho'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

SELECT public.ensure_updated_at_trigger('campaigns');


-- ── 3.3 campaign_metrics ─────────────────────────────────────────────────────
-- Colunas ctr/cpl/cpc/cpm/conversion_rate são colunas GERADAS (STORED)
-- Se a tabela já existir com estas colunas como regulares, o bloco será ignorado.

CREATE TABLE IF NOT EXISTS public.campaign_metrics (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id         uuid          NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  client_id           uuid          REFERENCES public.agency_clients(id) ON DELETE SET NULL,
  platform_account_id uuid          REFERENCES public.ad_platform_accounts(id) ON DELETE SET NULL,
  date                date          NOT NULL,
  impressions         bigint        NOT NULL DEFAULT 0,
  clicks              bigint        NOT NULL DEFAULT 0,
  link_clicks         bigint        NOT NULL DEFAULT 0,
  spend               numeric(12,2) NOT NULL DEFAULT 0,
  leads               integer       NOT NULL DEFAULT 0,
  conversions         integer       NOT NULL DEFAULT 0,
  reach               bigint        NOT NULL DEFAULT 0,
  frequency           numeric(6,2)  NOT NULL DEFAULT 0,
  video_views         bigint        NOT NULL DEFAULT 0,
  unique_ctr          numeric(8,4)  NOT NULL DEFAULT 0,
  -- computed columns
  ctr             numeric(10,4) GENERATED ALWAYS AS (
    CASE WHEN impressions > 0 THEN (clicks::numeric / impressions) * 100 ELSE 0 END
  ) STORED,
  cpl             numeric(12,2) GENERATED ALWAYS AS (
    CASE WHEN leads > 0 THEN spend / leads ELSE 0 END
  ) STORED,
  cpc             numeric(12,2) GENERATED ALWAYS AS (
    CASE WHEN clicks > 0 THEN spend / clicks ELSE 0 END
  ) STORED,
  cpm             numeric(12,2) GENERATED ALWAYS AS (
    CASE WHEN impressions > 0 THEN (spend / impressions) * 1000 ELSE 0 END
  ) STORED,
  conversion_rate numeric(8,4) GENERATED ALWAYS AS (
    CASE WHEN leads > 0 THEN (conversions::numeric / leads) * 100 ELSE 0 END
  ) STORED,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, date)
);

-- Colunas de métricas brutas (para tabela já existente sem elas)
ALTER TABLE public.campaign_metrics
  ADD COLUMN IF NOT EXISTS link_clicks         bigint        NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unique_ctr          numeric(8,4)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_account_id uuid          REFERENCES public.ad_platform_accounts(id) ON DELETE SET NULL;

-- Adicionar colunas computadas apenas se ainda não existirem como colunas regulares
DO $$ BEGIN
  ALTER TABLE public.campaign_metrics
    ADD COLUMN ctr numeric(10,4) GENERATED ALWAYS AS (
      CASE WHEN impressions > 0 THEN (clicks::numeric / impressions) * 100 ELSE 0 END
    ) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.campaign_metrics
    ADD COLUMN cpl numeric(12,2) GENERATED ALWAYS AS (
      CASE WHEN leads > 0 THEN spend / leads ELSE 0 END
    ) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.campaign_metrics
    ADD COLUMN cpc numeric(12,2) GENERATED ALWAYS AS (
      CASE WHEN clicks > 0 THEN spend / clicks ELSE 0 END
    ) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.campaign_metrics
    ADD COLUMN cpm numeric(12,2) GENERATED ALWAYS AS (
      CASE WHEN impressions > 0 THEN (spend / impressions) * 1000 ELSE 0 END
    ) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.campaign_metrics
    ADD COLUMN conversion_rate numeric(8,4) GENERATED ALWAYS AS (
      CASE WHEN leads > 0 THEN (conversions::numeric / leads) * 100 ELSE 0 END
    ) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.campaign_metrics ADD UNIQUE (campaign_id, date);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ── 3.4 traffic_client_settings ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.traffic_client_settings (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id           uuid          NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
  monthly_budget      numeric(12,2) NOT NULL DEFAULT 0,
  status              text          NOT NULL DEFAULT 'ativo'
                      CHECK (status IN ('ativo','pausado','inativo')),
  platforms           text[]        NOT NULL DEFAULT '{}',
  max_cpl             numeric(12,2),
  target_leads        integer,
  target_conversions  integer,
  min_ctr             numeric(8,4),
  target_roas         numeric(8,4),
  notes               text,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_id)
);

ALTER TABLE public.traffic_client_settings
  ADD COLUMN IF NOT EXISTS max_cpl            numeric(12,2),
  ADD COLUMN IF NOT EXISTS target_leads       integer,
  ADD COLUMN IF NOT EXISTS target_conversions integer,
  ADD COLUMN IF NOT EXISTS min_ctr            numeric(8,4),
  ADD COLUMN IF NOT EXISTS target_roas        numeric(8,4),
  ADD COLUMN IF NOT EXISTS notes              text,
  ADD COLUMN IF NOT EXISTS updated_at         timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE public.traffic_client_settings ADD CONSTRAINT traffic_client_settings_status_chk
    CHECK (status IN ('ativo','pausado','inativo'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.traffic_client_settings ADD UNIQUE (user_id, client_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

SELECT public.ensure_updated_at_trigger('traffic_client_settings');


-- ── 3.5 traffic_monthly_goals ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.traffic_monthly_goals (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id           uuid          REFERENCES public.agency_clients(id) ON DELETE CASCADE,
  year                smallint      NOT NULL,
  month               smallint      NOT NULL CHECK (month BETWEEN 1 AND 12),
  target_leads        integer       NOT NULL DEFAULT 0,
  max_cpl             numeric(12,2) NOT NULL DEFAULT 0,
  target_conversions  integer       NOT NULL DEFAULT 0,
  min_ctr             numeric(8,4)  NOT NULL DEFAULT 0,
  target_roas         numeric(8,4)  NOT NULL DEFAULT 0,
  monthly_budget      numeric(12,2) NOT NULL DEFAULT 0,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_id, year, month)
);

ALTER TABLE public.traffic_monthly_goals
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE public.traffic_monthly_goals ADD CONSTRAINT traffic_monthly_goals_month_chk
    CHECK (month BETWEEN 1 AND 12);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.traffic_monthly_goals ADD UNIQUE (user_id, client_id, year, month);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

SELECT public.ensure_updated_at_trigger('traffic_monthly_goals');


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOCO 4 — MÓDULO CRM
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 4.1 tags ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tags (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  color      text        NOT NULL DEFAULT '#4a8fd4',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

DO $$ BEGIN
  ALTER TABLE public.tags ADD UNIQUE (user_id, name);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ── 4.2 leads ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.leads (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  contact       text        NOT NULL DEFAULT '',
  email         text,
  source        text        NOT NULL DEFAULT 'manual',
  page_id       text,
  leadgen_id    text,
  campaign_name text,
  ad_name       text,
  form_id       text,
  form_name     text,
  is_duplicate  boolean     NOT NULL DEFAULT false,
  kanban_column text        NOT NULL DEFAULT 'abordados'
                CHECK (kanban_column IN ('abordados','em_andamento','formulario_aplicado',
                                         'reuniao_agendada','reuniao_realizada','no_show','venda_realizada')),
  tags          text[]      NOT NULL DEFAULT '{}',
  notes         text,
  deal_value    numeric(12,2) NOT NULL DEFAULT 0,
  entered_at    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS email         text,
  ADD COLUMN IF NOT EXISTS page_id       text,
  ADD COLUMN IF NOT EXISTS leadgen_id    text,
  ADD COLUMN IF NOT EXISTS campaign_name text,
  ADD COLUMN IF NOT EXISTS ad_name       text,
  ADD COLUMN IF NOT EXISTS form_id       text,
  ADD COLUMN IF NOT EXISTS form_name     text,
  ADD COLUMN IF NOT EXISTS is_duplicate  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tags          text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notes         text,
  ADD COLUMN IF NOT EXISTS deal_value    numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS entered_at    timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at    timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE public.leads ADD CONSTRAINT leads_kanban_column_chk
    CHECK (kanban_column IN ('abordados','em_andamento','formulario_aplicado',
                              'reuniao_agendada','reuniao_realizada','no_show','venda_realizada'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

SELECT public.ensure_updated_at_trigger('leads');


-- ── 4.3 lead_movements ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.lead_movements (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  from_column text        NOT NULL,
  to_column   text        NOT NULL,
  moved_at    timestamptz NOT NULL DEFAULT now()
);


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOCO 5 — INTEGRAÇÃO META ADS
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 5.1 meta_tokens ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.meta_tokens (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_account_id uuid        REFERENCES public.ad_platform_accounts(id) ON DELETE CASCADE,
  encrypted_token     text        NOT NULL,
  token_expires_at    timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_tokens
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at       timestamptz NOT NULL DEFAULT now();

SELECT public.ensure_updated_at_trigger('meta_tokens');


-- ── 5.2 meta_page_subscriptions ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.meta_page_subscriptions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_account_id uuid        REFERENCES public.ad_platform_accounts(id) ON DELETE SET NULL,
  meta_page_id        text,
  page_id             text,
  page_name           text,
  encrypted_page_token text,
  is_active           boolean     NOT NULL DEFAULT false,
  subscribed          boolean     NOT NULL DEFAULT false,
  error_message       text,
  last_synced_at      timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_page_subscriptions
  ADD COLUMN IF NOT EXISTS platform_account_id  uuid  REFERENCES public.ad_platform_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS meta_page_id         text,
  ADD COLUMN IF NOT EXISTS encrypted_page_token text,
  ADD COLUMN IF NOT EXISTS subscribed           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS error_message        text,
  ADD COLUMN IF NOT EXISTS last_synced_at       timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at           timestamptz NOT NULL DEFAULT now();

SELECT public.ensure_updated_at_trigger('meta_page_subscriptions');


-- ── 5.3 meta_form_subscriptions ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.meta_form_subscriptions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  form_id      text        NOT NULL,
  form_name    text,
  page_id      text,
  is_active    boolean     NOT NULL DEFAULT false,
  leads_count  integer     NOT NULL DEFAULT 0,
  last_lead_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, form_id)
);

ALTER TABLE public.meta_form_subscriptions
  ADD COLUMN IF NOT EXISTS form_name    text,
  ADD COLUMN IF NOT EXISTS leads_count  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_lead_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at   timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE public.meta_form_subscriptions ADD UNIQUE (user_id, form_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

SELECT public.ensure_updated_at_trigger('meta_form_subscriptions');


-- ── 5.4 meta_webhook_logs ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.meta_webhook_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  page_id       text,
  form_id       text,
  leadgen_id    text,
  status        text        NOT NULL DEFAULT 'received'
                CHECK (status IN ('received','processing','processed','error','skipped')),
  step          text,
  payload       jsonb,
  error_message text,
  processed_at  timestamptz,
  lead_id       uuid        REFERENCES public.leads(id) ON DELETE SET NULL,
  received_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_webhook_logs
  ADD COLUMN IF NOT EXISTS user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS step          text,
  ADD COLUMN IF NOT EXISTS payload       jsonb,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS processed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS lead_id       uuid REFERENCES public.leads(id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TABLE public.meta_webhook_logs ADD CONSTRAINT meta_webhook_logs_status_chk
    CHECK (status IN ('received','processing','processed','error','skipped'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOCO 6 — NPS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.nps_records (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id        uuid        NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
  reference_month  text        NOT NULL,
  score            smallint    NOT NULL CHECK (score BETWEEN 0 AND 10),
  classification   text GENERATED ALWAYS AS (
    CASE WHEN score >= 9 THEN 'promotor'
         WHEN score >= 7 THEN 'neutro'
         ELSE 'detrator'
    END
  ) STORED,
  comment          text,
  channel          text        NOT NULL DEFAULT 'manual'
                   CHECK (channel IN ('manual','formulario','whatsapp','outro')),
  responsible      text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_id, reference_month)
);

ALTER TABLE public.nps_records
  ADD COLUMN IF NOT EXISTS comment     text,
  ADD COLUMN IF NOT EXISTS responsible text,
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();

-- Adicionar classification como coluna gerada (se não existir ainda)
DO $$ BEGIN
  ALTER TABLE public.nps_records
    ADD COLUMN classification text GENERATED ALWAYS AS (
      CASE WHEN score >= 9 THEN 'promotor'
           WHEN score >= 7 THEN 'neutro'
           ELSE 'detrator'
      END
    ) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.nps_records ADD CONSTRAINT nps_records_score_chk
    CHECK (score BETWEEN 0 AND 10);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.nps_records ADD CONSTRAINT nps_records_channel_chk
    CHECK (channel IN ('manual','formulario','whatsapp','outro'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.nps_records ADD UNIQUE (user_id, client_id, reference_month);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

SELECT public.ensure_updated_at_trigger('nps_records');


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOCO 7 — USUÁRIOS / CONFIGURAÇÕES
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 7.1 user_profiles ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auth_user_id  uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     text        NOT NULL,
  email         text        NOT NULL,
  role          text        NOT NULL DEFAULT 'viewer'
                CHECK (role IN ('admin','editor','viewer')),
  job_title     text,
  is_active     boolean     NOT NULL DEFAULT true,
  avatar_url    text,
  last_seen_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS auth_user_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS job_title     text,
  ADD COLUMN IF NOT EXISTS is_active     boolean     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS avatar_url    text,
  ADD COLUMN IF NOT EXISTS last_seen_at  timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at    timestamptz NOT NULL DEFAULT now();

-- Normalizar dados existentes antes de adicionar constraint
UPDATE public.user_profiles SET role = 'viewer' WHERE role NOT IN ('admin','editor','viewer');

DO $$ BEGIN
  ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_chk
    CHECK (role IN ('admin','editor','viewer'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

SELECT public.ensure_updated_at_trigger('user_profiles');


-- ── 7.2 user_invites ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_invites (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  role        text        NOT NULL DEFAULT 'viewer'
              CHECK (role IN ('admin','editor','viewer')),
  status      text        NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','accepted','expired','cancelled')),
  invited_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_invites
  ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days');

-- Normalizar dados existentes antes de adicionar constraint
UPDATE public.user_invites SET role = 'viewer' WHERE role NOT IN ('admin','editor','viewer');

DO $$ BEGIN
  ALTER TABLE public.user_invites ADD CONSTRAINT user_invites_role_chk
    CHECK (role IN ('admin','editor','viewer'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.user_invites ADD CONSTRAINT user_invites_status_chk
    CHECK (status IN ('pending','accepted','expired','cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ── 7.3 security_settings ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.security_settings (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notify_new_login        boolean     NOT NULL DEFAULT true,
  notify_suspicious       boolean     NOT NULL DEFAULT true,
  require_strong_password boolean     NOT NULL DEFAULT false,
  auto_logout             boolean     NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.security_settings
  ADD COLUMN IF NOT EXISTS notify_suspicious       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS require_strong_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_logout             boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at              timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE public.security_settings ADD UNIQUE (user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

SELECT public.ensure_updated_at_trigger('security_settings');


-- ── 7.4 security_logs ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.security_logs (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action     text        NOT NULL,
  metadata   jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.security_logs
  ADD COLUMN IF NOT EXISTS metadata jsonb;


-- ── 7.5 company_profile ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.company_profile (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text,
  trade_name   text,
  logo_url     text,
  website      text,
  description  text,
  cnpj         text,
  email        text,
  phone        text,
  whatsapp     text,
  address      text,
  city         text,
  state        text,
  zip_code     text,
  country      text        NOT NULL DEFAULT 'BR',
  timezone     text        NOT NULL DEFAULT 'America/Sao_Paulo',
  currency     text        NOT NULL DEFAULT 'BRL',
  language     text        NOT NULL DEFAULT 'pt-BR',
  date_format  text        NOT NULL DEFAULT 'dd/MM/yyyy',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.company_profile
  ADD COLUMN IF NOT EXISTS cnpj        text,
  ADD COLUMN IF NOT EXISTS whatsapp    text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS timezone    text NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS currency    text NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS language    text NOT NULL DEFAULT 'pt-BR',
  ADD COLUMN IF NOT EXISTS date_format text NOT NULL DEFAULT 'dd/MM/yyyy',
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE public.company_profile ADD UNIQUE (user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

SELECT public.ensure_updated_at_trigger('company_profile');


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOCO 8 — ÍNDICES
-- ═══════════════════════════════════════════════════════════════════════════

-- agency_clients
CREATE INDEX IF NOT EXISTS idx_agency_clients_user_id  ON public.agency_clients (user_id);
CREATE INDEX IF NOT EXISTS idx_agency_clients_status   ON public.agency_clients (status);

-- client_cost_shares
CREATE INDEX IF NOT EXISTS idx_cost_shares_client_id   ON public.client_cost_shares (client_id);
CREATE INDEX IF NOT EXISTS idx_cost_shares_user_id     ON public.client_cost_shares (user_id);

-- revenues
CREATE INDEX IF NOT EXISTS idx_revenues_user_id        ON public.revenues (user_id);
CREATE INDEX IF NOT EXISTS idx_revenues_client_id      ON public.revenues (client_id);
CREATE INDEX IF NOT EXISTS idx_revenues_date           ON public.revenues (date);
CREATE INDEX IF NOT EXISTS idx_revenues_status         ON public.revenues (status);
CREATE INDEX IF NOT EXISTS idx_revenues_due_date       ON public.revenues (due_date) WHERE status != 'pago';

-- expenses
CREATE INDEX IF NOT EXISTS idx_expenses_user_id        ON public.expenses (user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_client_id      ON public.expenses (client_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date           ON public.expenses (date);
CREATE INDEX IF NOT EXISTS idx_expenses_category       ON public.expenses (category);

-- collections
CREATE INDEX IF NOT EXISTS idx_collections_user_id     ON public.collections (user_id);
CREATE INDEX IF NOT EXISTS idx_collections_client_id   ON public.collections (client_id);
CREATE INDEX IF NOT EXISTS idx_collections_status      ON public.collections (status);
CREATE INDEX IF NOT EXISTS idx_collections_due_date    ON public.collections (due_date);

-- financial_goals
CREATE INDEX IF NOT EXISTS idx_financial_goals_user_id ON public.financial_goals (user_id, year, month);

-- campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id       ON public.campaigns (user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_client_id     ON public.campaigns (client_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status        ON public.campaigns (status);
CREATE INDEX IF NOT EXISTS idx_campaigns_platform      ON public.campaigns (platform);

-- campaign_metrics
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_campaign_id         ON public.campaign_metrics (campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_client_id           ON public.campaign_metrics (client_id);
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_date                ON public.campaign_metrics (date);
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_platform_account_id ON public.campaign_metrics (platform_account_id);

-- leads
CREATE INDEX IF NOT EXISTS idx_leads_user_id           ON public.leads (user_id);
CREATE INDEX IF NOT EXISTS idx_leads_kanban_column     ON public.leads (kanban_column);
CREATE INDEX IF NOT EXISTS idx_leads_source            ON public.leads (source);
CREATE INDEX IF NOT EXISTS idx_leads_leadgen_id        ON public.leads (leadgen_id) WHERE leadgen_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_created_at        ON public.leads (created_at DESC);

-- lead_movements
CREATE INDEX IF NOT EXISTS idx_lead_movements_lead_id  ON public.lead_movements (lead_id);

-- tags
CREATE INDEX IF NOT EXISTS idx_tags_user_id            ON public.tags (user_id);

-- meta_tokens
CREATE INDEX IF NOT EXISTS idx_meta_tokens_user_id               ON public.meta_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_meta_tokens_platform_account_id   ON public.meta_tokens (platform_account_id);

-- meta_page_subscriptions
CREATE INDEX IF NOT EXISTS idx_meta_pages_user_id                ON public.meta_page_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_meta_pages_page_id                ON public.meta_page_subscriptions (page_id);
CREATE INDEX IF NOT EXISTS idx_meta_pages_is_active              ON public.meta_page_subscriptions (is_active);

-- meta_form_subscriptions
CREATE INDEX IF NOT EXISTS idx_meta_forms_user_id                ON public.meta_form_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_meta_forms_page_id                ON public.meta_form_subscriptions (page_id);
CREATE INDEX IF NOT EXISTS idx_meta_forms_is_active              ON public.meta_form_subscriptions (is_active);

-- meta_webhook_logs
CREATE INDEX IF NOT EXISTS idx_webhook_logs_user_id              ON public.meta_webhook_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_leadgen_id           ON public.meta_webhook_logs (leadgen_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_received_at          ON public.meta_webhook_logs (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status               ON public.meta_webhook_logs (status);

-- nps_records
CREATE INDEX IF NOT EXISTS idx_nps_records_user_id               ON public.nps_records (user_id);
CREATE INDEX IF NOT EXISTS idx_nps_records_client_id             ON public.nps_records (client_id);
CREATE INDEX IF NOT EXISTS idx_nps_records_reference_month       ON public.nps_records (reference_month);
CREATE INDEX IF NOT EXISTS idx_nps_records_score                 ON public.nps_records (score);

-- security_logs
CREATE INDEX IF NOT EXISTS idx_security_logs_user_id             ON public.security_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at          ON public.security_logs (created_at DESC);

-- traffic_client_settings
CREATE INDEX IF NOT EXISTS idx_traffic_client_settings_user_id   ON public.traffic_client_settings (user_id);
CREATE INDEX IF NOT EXISTS idx_traffic_monthly_goals_user_id     ON public.traffic_monthly_goals (user_id, year, month);

-- ad_platform_accounts
CREATE INDEX IF NOT EXISTS idx_ad_platform_accounts_user_id      ON public.ad_platform_accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_ad_platform_accounts_platform     ON public.ad_platform_accounts (platform);
CREATE INDEX IF NOT EXISTS idx_ad_platform_accounts_status       ON public.ad_platform_accounts (status);


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOCO 9 — ROW LEVEL SECURITY (RLS)
-- Padrão: usuário acessa apenas seus próprios dados via user_id = auth.uid()
-- ═══════════════════════════════════════════════════════════════════════════

-- Macro para aplicar RLS padrão em qualquer tabela com user_id
CREATE OR REPLACE FUNCTION public.apply_standard_rls(tbl text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_select', tbl);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_insert', tbl);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_update', tbl);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_delete', tbl);
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR SELECT USING (auth.uid() = user_id)',
    tbl || '_select', tbl
  );
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (auth.uid() = user_id)',
    tbl || '_insert', tbl
  );
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR UPDATE USING (auth.uid() = user_id)',
    tbl || '_update', tbl
  );
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR DELETE USING (auth.uid() = user_id)',
    tbl || '_delete', tbl
  );
END;
$$;

SELECT public.apply_standard_rls('agency_clients');
SELECT public.apply_standard_rls('client_cost_shares');
SELECT public.apply_standard_rls('revenues');
SELECT public.apply_standard_rls('expenses');
SELECT public.apply_standard_rls('collections');
SELECT public.apply_standard_rls('financial_goals');
SELECT public.apply_standard_rls('ad_platform_accounts');
SELECT public.apply_standard_rls('campaigns');
SELECT public.apply_standard_rls('campaign_metrics');
SELECT public.apply_standard_rls('traffic_client_settings');
SELECT public.apply_standard_rls('traffic_monthly_goals');
SELECT public.apply_standard_rls('tags');
SELECT public.apply_standard_rls('leads');
SELECT public.apply_standard_rls('meta_tokens');
SELECT public.apply_standard_rls('meta_page_subscriptions');
SELECT public.apply_standard_rls('meta_form_subscriptions');
SELECT public.apply_standard_rls('nps_records');
SELECT public.apply_standard_rls('security_settings');
SELECT public.apply_standard_rls('security_logs');
SELECT public.apply_standard_rls('company_profile');

-- user_profiles e user_invites usam owner_id (não user_id) — RLS manual
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_profiles_select ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_insert ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_update ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_delete ON public.user_profiles;
CREATE POLICY user_profiles_select ON public.user_profiles FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY user_profiles_insert ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY user_profiles_update ON public.user_profiles FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY user_profiles_delete ON public.user_profiles FOR DELETE USING (auth.uid() = owner_id);

ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_invites_select ON public.user_invites;
DROP POLICY IF EXISTS user_invites_insert ON public.user_invites;
DROP POLICY IF EXISTS user_invites_update ON public.user_invites;
DROP POLICY IF EXISTS user_invites_delete ON public.user_invites;
CREATE POLICY user_invites_select ON public.user_invites FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY user_invites_insert ON public.user_invites FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY user_invites_update ON public.user_invites FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY user_invites_delete ON public.user_invites FOR DELETE USING (auth.uid() = owner_id);

-- lead_movements: sem user_id direto — política via lead_id → leads.user_id
ALTER TABLE public.lead_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_movements_select ON public.lead_movements;
DROP POLICY IF EXISTS lead_movements_insert ON public.lead_movements;
DROP POLICY IF EXISTS lead_movements_delete ON public.lead_movements;

CREATE POLICY lead_movements_select ON public.lead_movements
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.user_id = auth.uid())
  );
CREATE POLICY lead_movements_insert ON public.lead_movements
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.user_id = auth.uid())
  );
CREATE POLICY lead_movements_delete ON public.lead_movements
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.user_id = auth.uid())
  );

-- meta_webhook_logs: user_id pode ser NULL (chamada do webhook antes de saber o usuário)
ALTER TABLE public.meta_webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meta_webhook_logs_select ON public.meta_webhook_logs;
DROP POLICY IF EXISTS meta_webhook_logs_insert ON public.meta_webhook_logs;
DROP POLICY IF EXISTS meta_webhook_logs_update ON public.meta_webhook_logs;

CREATE POLICY meta_webhook_logs_select ON public.meta_webhook_logs
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY meta_webhook_logs_insert ON public.meta_webhook_logs
  FOR INSERT WITH CHECK (true);  -- webhook server-side usa service_role
CREATE POLICY meta_webhook_logs_update ON public.meta_webhook_logs
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOCO 10 — VIEWS ANALÍTICAS
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 10.1 v_client_profitability — Rentabilidade por cliente ──────────────────
CREATE OR REPLACE VIEW public.v_client_profitability AS
SELECT
  c.id                                           AS client_id,
  c.user_id,
  c.name,
  c.status,
  c.monthly_fee,
  c.contract_start,
  c.contract_end,
  COALESCE(SUM(cs.percentage * c.monthly_fee / 100), 0)        AS custo_parceiros,
  c.monthly_fee - COALESCE(SUM(cs.percentage * c.monthly_fee / 100), 0) AS lucro,
  CASE WHEN c.monthly_fee > 0
    THEN ((c.monthly_fee - COALESCE(SUM(cs.percentage * c.monthly_fee / 100), 0)) / c.monthly_fee) * 100
    ELSE 0
  END                                            AS margem_pct,
  GREATEST(0,
    DATE_PART('year', AGE(
      COALESCE(c.contract_end, CURRENT_DATE),
      COALESCE(c.contract_start, c.created_at::date)
    )) * 12 +
    DATE_PART('month', AGE(
      COALESCE(c.contract_end, CURRENT_DATE),
      COALESCE(c.contract_start, c.created_at::date)
    ))
  )::integer                                     AS meses_contrato
FROM public.agency_clients c
LEFT JOIN public.client_cost_shares cs ON cs.client_id = c.id
GROUP BY c.id;


-- ── 10.2 v_mrr_snapshot — MRR atual por usuário ──────────────────────────────
CREATE OR REPLACE VIEW public.v_mrr_snapshot AS
SELECT
  user_id,
  COUNT(*)           FILTER (WHERE status = 'ativo')                AS clientes_ativos,
  SUM(monthly_fee)   FILTER (WHERE status = 'ativo')                AS mrr,
  COUNT(*)           FILTER (WHERE status = 'churned')              AS total_churned,
  AVG(monthly_fee)   FILTER (WHERE status = 'ativo')                AS ticket_medio,
  MIN(contract_start)                                                AS cliente_mais_antigo
FROM public.agency_clients
GROUP BY user_id;


-- ── 10.3 v_nps_monthly — NPS consolidado por mês ─────────────────────────────
CREATE OR REPLACE VIEW public.v_nps_monthly AS
SELECT
  user_id,
  reference_month,
  COUNT(*)                                               AS total_respostas,
  COUNT(*) FILTER (WHERE classification = 'promotor')   AS promotores,
  COUNT(*) FILTER (WHERE classification = 'neutro')     AS neutros,
  COUNT(*) FILTER (WHERE classification = 'detrator')   AS detratores,
  ROUND(
    (COUNT(*) FILTER (WHERE classification = 'promotor')::numeric -
     COUNT(*) FILTER (WHERE classification = 'detrator')::numeric) /
    NULLIF(COUNT(*), 0) * 100,
  1)                                                     AS nps_score,
  ROUND(AVG(score), 2)                                   AS score_medio
FROM public.nps_records
GROUP BY user_id, reference_month;


-- ── 10.4 v_churn_monthly — Churn mensal de clientes ──────────────────────────
CREATE OR REPLACE VIEW public.v_churn_monthly AS
SELECT
  user_id,
  DATE_TRUNC('month', contract_end)::date    AS mes_churn,
  TO_CHAR(contract_end, 'YYYY-MM')           AS reference_month,
  COUNT(*)                                    AS cancelamentos,
  SUM(monthly_fee)                            AS mrr_perdido
FROM public.agency_clients
WHERE contract_end IS NOT NULL
GROUP BY user_id, DATE_TRUNC('month', contract_end), TO_CHAR(contract_end, 'YYYY-MM');


-- ── 10.5 v_revenue_summary — Resumo financeiro mensal ────────────────────────
CREATE OR REPLACE VIEW public.v_revenue_summary AS
SELECT
  user_id,
  DATE_TRUNC('month', date)::date        AS mes,
  TO_CHAR(date, 'YYYY-MM')               AS reference_month,
  SUM(amount) FILTER (WHERE status = 'pago')      AS faturamento,
  SUM(amount)                                      AS receita_total,
  SUM(amount) FILTER (WHERE status = 'atrasado')   AS inadimplencia,
  COUNT(*) FILTER (WHERE status = 'pago')          AS qtd_pago,
  COUNT(*) FILTER (WHERE status = 'pendente')      AS qtd_pendente,
  COUNT(*) FILTER (WHERE status = 'atrasado')      AS qtd_atrasado
FROM public.revenues
GROUP BY user_id, DATE_TRUNC('month', date), TO_CHAR(date, 'YYYY-MM');


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOCO 11 — BACKFILL / DADOS EXISTENTES
-- ═══════════════════════════════════════════════════════════════════════════

-- Garantir que registros existentes tenham updated_at preenchido
UPDATE public.agency_clients    SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE public.revenues          SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE public.expenses          SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE public.collections       SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE public.campaigns         SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE public.nps_records       SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE public.client_cost_shares SET updated_at = created_at WHERE updated_at IS NULL;

-- Normalizar company_type para valores válidos (dados antigos)
UPDATE public.agency_clients
  SET company_type = 'outro'
WHERE company_type NOT IN ('imobiliaria','construtora','corretor','outro');

-- Normalizar status para valores válidos
UPDATE public.agency_clients
  SET status = 'ativo'
WHERE status NOT IN ('ativo','inativo','churned');

-- Garantir score NPS dentro do range 0-10
UPDATE public.nps_records
  SET score = GREATEST(0, LEAST(10, score))
WHERE score < 0 OR score > 10;


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOCO 12 — LIMPEZA DOS HELPERS
-- ═══════════════════════════════════════════════════════════════════════════

-- As funções auxiliares podem ser mantidas para uso futuro ou removidas
-- DROP FUNCTION IF EXISTS public.ensure_updated_at_trigger(text);
-- DROP FUNCTION IF EXISTS public.apply_standard_rls(text);
-- (comentado: manter disponíveis para novas migrations)


-- ═══════════════════════════════════════════════════════════════════════════
-- FIM DA MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════
