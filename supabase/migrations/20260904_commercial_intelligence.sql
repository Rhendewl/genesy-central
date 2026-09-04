-- =============================================================================
-- Análise Comercial v2 — inteligência comercial e coletas automatizadas
-- Idempotente e compatível com client_commercial_analyses (legado).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.commercial_intelligence_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
  frequency text NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('weekly','biweekly','monthly')),
  meta_account_ids uuid[] NOT NULL DEFAULT '{}',
  parser_pattern text NOT NULL DEFAULT '\[([^\]]+)\]',
  parser_group integer NOT NULL DEFAULT 1 CHECK (parser_group >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_id)
);

CREATE TABLE IF NOT EXISTS public.commercial_brokers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, email)
);

CREATE TABLE IF NOT EXISTS public.commercial_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  week_number integer CHECK (week_number BETWEEN 1 AND 4),
  questions jsonb NOT NULL DEFAULT '[]',
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.commercial_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.commercial_templates(id) ON DELETE SET NULL,
  legacy_analysis_id uuid REFERENCES public.client_commercial_analyses(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','closed','archived')),
  developments jsonb NOT NULL DEFAULT '[]',
  meta_snapshot jsonb NOT NULL DEFAULT '{}',
  ai_diagnosis jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);

CREATE TABLE IF NOT EXISTS public.commercial_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.commercial_collections(id) ON DELETE CASCADE,
  broker_id uuid NOT NULL REFERENCES public.commercial_brokers(id) ON DELETE RESTRICT,
  development_name text NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}',
  score numeric(4,2),
  objection text,
  respondent_key text,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, broker_id, development_name)
);

CREATE INDEX IF NOT EXISTS commercial_brokers_client_idx ON public.commercial_brokers(client_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS commercial_templates_default_week_idx
  ON public.commercial_templates(user_id, week_number) WHERE is_system = true;
CREATE INDEX IF NOT EXISTS commercial_collections_client_period_idx ON public.commercial_collections(client_id, period_end DESC);
CREATE INDEX IF NOT EXISTS commercial_responses_collection_idx ON public.commercial_responses(collection_id, completed_at DESC);

ALTER TABLE public.commercial_intelligence_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_responses ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'commercial_intelligence_settings','commercial_brokers','commercial_templates',
    'commercial_collections','commercial_responses'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_owner_all', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (public.effective_owner_id() = user_id) WITH CHECK (public.effective_owner_id() = user_id)',
      table_name || '_owner_all', table_name
    );
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_auto_owner_commercial_settings ON public.commercial_intelligence_settings;
CREATE TRIGGER trg_auto_owner_commercial_settings BEFORE INSERT ON public.commercial_intelligence_settings
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_owner_id();
DROP TRIGGER IF EXISTS trg_auto_owner_commercial_brokers ON public.commercial_brokers;
CREATE TRIGGER trg_auto_owner_commercial_brokers BEFORE INSERT ON public.commercial_brokers
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_owner_id();
DROP TRIGGER IF EXISTS trg_auto_owner_commercial_templates ON public.commercial_templates;
CREATE TRIGGER trg_auto_owner_commercial_templates BEFORE INSERT ON public.commercial_templates
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_owner_id();
DROP TRIGGER IF EXISTS trg_auto_owner_commercial_collections ON public.commercial_collections;
CREATE TRIGGER trg_auto_owner_commercial_collections BEFORE INSERT ON public.commercial_collections
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_owner_id();
DROP TRIGGER IF EXISTS trg_auto_owner_commercial_responses ON public.commercial_responses;
CREATE TRIGGER trg_auto_owner_commercial_responses BEFORE INSERT ON public.commercial_responses
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_owner_id();

SELECT public.ensure_updated_at_trigger('commercial_intelligence_settings');
SELECT public.ensure_updated_at_trigger('commercial_brokers');
SELECT public.ensure_updated_at_trigger('commercial_templates');
SELECT public.ensure_updated_at_trigger('commercial_collections');

-- O histórico antigo continua disponível e pode ser relacionado gradualmente.
COMMENT ON TABLE public.commercial_collections IS
  'Coletas da Análise Comercial v2. A tabela client_commercial_analyses permanece intacta para compatibilidade.';
