-- Análises comerciais semanais, organizadas na pasta de cada cliente.

CREATE TABLE IF NOT EXISTS public.client_commercial_analyses (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id             uuid NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
  created_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  meeting_date          date NOT NULL,
  period_start          date NOT NULL,
  period_end            date NOT NULL,
  participants          text,
  leads_received        integer NOT NULL DEFAULT 0 CHECK (leads_received >= 0),
  leads_contacted       integer NOT NULL DEFAULT 0 CHECK (leads_contacted >= 0),
  leads_responded       integer NOT NULL DEFAULT 0 CHECK (leads_responded >= 0),
  leads_no_response     integer NOT NULL DEFAULT 0 CHECK (leads_no_response >= 0),
  qualified_leads       integer NOT NULL DEFAULT 0 CHECK (qualified_leads >= 0),
  disqualified_leads    integer NOT NULL DEFAULT 0 CHECK (disqualified_leads >= 0),
  hot_leads             integer NOT NULL DEFAULT 0 CHECK (hot_leads >= 0),
  warm_leads            integer NOT NULL DEFAULT 0 CHECK (warm_leads >= 0),
  cold_leads            integer NOT NULL DEFAULT 0 CHECK (cold_leads >= 0),
  product_type          text NOT NULL CHECK (product_type IN (
                           'residential_low','residential_mid','residential_high',
                           'studios_flats','land_development','commercial'
                         )),
  development_name      text,
  meetings_scheduled    integer NOT NULL DEFAULT 0 CHECK (meetings_scheduled >= 0),
  meetings_held         integer NOT NULL DEFAULT 0 CHECK (meetings_held >= 0),
  no_shows              integer NOT NULL DEFAULT 0 CHECK (no_shows >= 0),
  rescheduled_meetings  integer NOT NULL DEFAULT 0 CHECK (rescheduled_meetings >= 0),
  qualified_meetings    integer NOT NULL DEFAULT 0 CHECK (qualified_meetings >= 0),
  proposals_sent        integer NOT NULL DEFAULT 0 CHECK (proposals_sent >= 0),
  sales_closed          integer NOT NULL DEFAULT 0 CHECK (sales_closed >= 0),
  revenue               numeric(14,2) NOT NULL DEFAULT 0 CHECK (revenue >= 0),
  lost_sales            integer NOT NULL DEFAULT 0 CHECK (lost_sales >= 0),
  response_notes        text,
  lead_profile_notes    text,
  meeting_notes         text,
  loss_reasons          text,
  wins                  text,
  blockers              text,
  decisions             text,
  next_actions          text,
  analysis_snapshot     jsonb NOT NULL DEFAULT '{}',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_analysis_valid_period CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS commercial_analyses_client_date_idx
  ON public.client_commercial_analyses (client_id, meeting_date DESC);
CREATE INDEX IF NOT EXISTS commercial_analyses_owner_idx
  ON public.client_commercial_analyses (user_id);

ALTER TABLE public.client_commercial_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_analyses_select ON public.client_commercial_analyses;
DROP POLICY IF EXISTS commercial_analyses_insert ON public.client_commercial_analyses;
DROP POLICY IF EXISTS commercial_analyses_update ON public.client_commercial_analyses;
DROP POLICY IF EXISTS commercial_analyses_delete ON public.client_commercial_analyses;

CREATE POLICY commercial_analyses_select ON public.client_commercial_analyses
  FOR SELECT USING (public.effective_owner_id() = user_id);
CREATE POLICY commercial_analyses_insert ON public.client_commercial_analyses
  FOR INSERT WITH CHECK (public.effective_owner_id() = user_id);
CREATE POLICY commercial_analyses_update ON public.client_commercial_analyses
  FOR UPDATE USING (public.effective_owner_id() = user_id);
CREATE POLICY commercial_analyses_delete ON public.client_commercial_analyses
  FOR DELETE USING (public.effective_owner_id() = user_id);

DROP TRIGGER IF EXISTS trg_auto_owner_commercial_analyses ON public.client_commercial_analyses;
CREATE TRIGGER trg_auto_owner_commercial_analyses
  BEFORE INSERT ON public.client_commercial_analyses
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_owner_id();

SELECT public.ensure_updated_at_trigger('client_commercial_analyses');
