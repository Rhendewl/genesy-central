-- CRM: significado analítico das etapas + metas comerciais por período.

ALTER TABLE public.crm_stages
  ADD COLUMN IF NOT EXISTS metric_type text;

DO $$ BEGIN
  ALTER TABLE public.crm_stages
    ADD CONSTRAINT crm_stages_metric_type_check CHECK (
      metric_type IS NULL OR metric_type IN (
        'qualified_lead', 'meeting_scheduled', 'meeting_held', 'sale', 'lost'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Compatibilidade inicial com as etapas legadas e com a marcação já existente.
UPDATE public.crm_stages
SET metric_type = CASE
  WHEN is_won OR legacy_column = 'venda_realizada' THEN 'sale'
  WHEN is_lost THEN 'lost'
  WHEN legacy_column = 'reuniao_agendada' THEN 'meeting_scheduled'
  WHEN legacy_column = 'reuniao_realizada' THEN 'meeting_held'
  WHEN legacy_column IN ('em_andamento', 'formulario_aplicado') THEN 'qualified_lead'
  ELSE metric_type
END
WHERE metric_type IS NULL;

CREATE TABLE IF NOT EXISTS public.crm_goals (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pipeline_id               uuid REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  name                      text NOT NULL,
  starts_at                 date NOT NULL,
  ends_at                   date NOT NULL,
  revenue_target            numeric(14,2) CHECK (revenue_target IS NULL OR revenue_target >= 0),
  sales_target              integer CHECK (sales_target IS NULL OR sales_target >= 0),
  held_meetings_target      integer CHECK (held_meetings_target IS NULL OR held_meetings_target >= 0),
  scheduled_meetings_target integer CHECK (scheduled_meetings_target IS NULL OR scheduled_meetings_target >= 0),
  is_active                 boolean NOT NULL DEFAULT true,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_goals_valid_period CHECK (ends_at >= starts_at),
  CONSTRAINT crm_goals_has_target CHECK (
    COALESCE(revenue_target, 0) > 0 OR
    COALESCE(sales_target, 0) > 0 OR
    COALESCE(held_meetings_target, 0) > 0 OR
    COALESCE(scheduled_meetings_target, 0) > 0
  )
);

CREATE INDEX IF NOT EXISTS crm_goals_owner_period_idx
  ON public.crm_goals (user_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS crm_goals_pipeline_idx
  ON public.crm_goals (pipeline_id);

ALTER TABLE public.crm_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_goals_select ON public.crm_goals;
DROP POLICY IF EXISTS crm_goals_insert ON public.crm_goals;
DROP POLICY IF EXISTS crm_goals_update ON public.crm_goals;
DROP POLICY IF EXISTS crm_goals_delete ON public.crm_goals;

CREATE POLICY crm_goals_select ON public.crm_goals
  FOR SELECT USING (public.effective_owner_id() = user_id);
CREATE POLICY crm_goals_insert ON public.crm_goals
  FOR INSERT WITH CHECK (
    public.effective_owner_id() = user_id
    AND (auth.uid() = user_id OR public.is_admin_of_user(user_id))
  );
CREATE POLICY crm_goals_update ON public.crm_goals
  FOR UPDATE USING (
    public.effective_owner_id() = user_id
    AND (auth.uid() = user_id OR public.is_admin_of_user(user_id))
  );
CREATE POLICY crm_goals_delete ON public.crm_goals
  FOR DELETE USING (
    public.effective_owner_id() = user_id
    AND (auth.uid() = user_id OR public.is_admin_of_user(user_id))
  );

DROP TRIGGER IF EXISTS trg_auto_owner_crm_goals ON public.crm_goals;
CREATE TRIGGER trg_auto_owner_crm_goals
  BEFORE INSERT ON public.crm_goals
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_owner_id();

SELECT public.ensure_updated_at_trigger('crm_goals');
