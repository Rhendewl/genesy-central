-- Automação diária das coletas de análise comercial.
-- Permanece desativada até ser habilitada explicitamente por cliente.

ALTER TABLE public.commercial_intelligence_settings
  ADD COLUMN IF NOT EXISTS automation_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS minimum_leads integer NOT NULL DEFAULT 5 CHECK (minimum_leads >= 1),
  ADD COLUMN IF NOT EXISTS minimum_active_days integer NOT NULL DEFAULT 3 CHECK (minimum_active_days BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS last_automation_check_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_automation_status text,
  ADD COLUMN IF NOT EXISTS last_automation_reason text,
  ADD COLUMN IF NOT EXISTS last_automatic_collection_at timestamptz;

ALTER TABLE public.commercial_collections
  ADD COLUMN IF NOT EXISTS automation_key text;

CREATE UNIQUE INDEX IF NOT EXISTS commercial_collections_automation_key_idx
  ON public.commercial_collections(automation_key)
  WHERE automation_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.commercial_collection_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.commercial_collections(id) ON DELETE CASCADE,
  broker_id uuid REFERENCES public.commercial_brokers(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, broker_id)
);

CREATE TABLE IF NOT EXISTS public.commercial_automation_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  settings_id uuid NOT NULL REFERENCES public.commercial_intelligence_settings(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
  check_date date NOT NULL,
  status text NOT NULL DEFAULT 'running',
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (settings_id, check_date)
);

CREATE INDEX IF NOT EXISTS commercial_collection_deliveries_pending_idx
  ON public.commercial_collection_deliveries(collection_id, status);

ALTER TABLE public.commercial_collection_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_automation_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_collection_deliveries_owner_all
  ON public.commercial_collection_deliveries;
CREATE POLICY commercial_collection_deliveries_owner_all
  ON public.commercial_collection_deliveries
  FOR ALL
  USING (public.effective_owner_id() = user_id)
  WITH CHECK (public.effective_owner_id() = user_id);

DROP POLICY IF EXISTS commercial_automation_checks_owner_all
  ON public.commercial_automation_checks;
CREATE POLICY commercial_automation_checks_owner_all
  ON public.commercial_automation_checks
  FOR ALL
  USING (public.effective_owner_id() = user_id)
  WITH CHECK (public.effective_owner_id() = user_id);

DROP TRIGGER IF EXISTS trg_auto_owner_commercial_collection_deliveries
  ON public.commercial_collection_deliveries;
CREATE TRIGGER trg_auto_owner_commercial_collection_deliveries
  BEFORE INSERT ON public.commercial_collection_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_owner_id();

SELECT public.ensure_updated_at_trigger('commercial_collection_deliveries');
SELECT public.ensure_updated_at_trigger('commercial_automation_checks');

COMMENT ON COLUMN public.commercial_intelligence_settings.automation_enabled IS
  'Ativa a verificação diária e o envio automático das coletas deste cliente.';
COMMENT ON TABLE public.commercial_collection_deliveries IS
  'Controle idempotente dos e-mails enviados aos corretores em cada coleta automática.';
COMMENT ON COLUMN public.commercial_collections.automation_key IS
  'Chave que impede dois agendadores de criarem a mesma coleta automática.';
COMMENT ON TABLE public.commercial_automation_checks IS
  'Trava diária que impede projetos ou execuções concorrentes de repetirem a sincronização e o envio.';
