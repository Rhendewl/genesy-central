BEGIN;
-- Preserve existing objectives, indicators and their cumulative values.
ALTER TABLE public.workspace_objectives ADD COLUMN perspective text
 CHECK (perspective IN ('financeira','clientes','processos','aprendizado'));
ALTER TABLE public.workspace_objective_metrics ADD COLUMN description text NOT NULL DEFAULT '';
CREATE TABLE public.workspace_objective_metric_periods (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 metric_id uuid NOT NULL REFERENCES public.workspace_objective_metrics(id) ON DELETE CASCADE,
 month date NOT NULL CHECK (extract(day FROM month)=1),
 baseline numeric NOT NULL DEFAULT 0,
 target numeric NOT NULL,
 current_value numeric NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(metric_id,month),
 CHECK(target<>baseline),
 CHECK(baseline::text NOT IN ('NaN','Infinity','-Infinity')),
 CHECK(target::text NOT IN ('NaN','Infinity','-Infinity')),
 CHECK(current_value::text NOT IN ('NaN','Infinity','-Infinity'))
);
ALTER TABLE public.workspace_objective_metric_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY access ON public.workspace_objective_metric_periods FOR ALL TO authenticated
 USING (EXISTS (SELECT 1 FROM public.workspace_objective_metrics m WHERE m.id=metric_id AND public.can_access_workspace_objective(m.objective_id)))
 WITH CHECK (EXISTS (SELECT 1 FROM public.workspace_objective_metrics m WHERE m.id=metric_id AND public.can_access_workspace_objective(m.objective_id)));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.workspace_objective_metric_periods TO authenticated;
CREATE FUNCTION public.touch_workspace_metric_period() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 NEW.updated_at:=now();
 IF TG_OP='UPDATE' AND (NEW.metric_id<>OLD.metric_id OR NEW.month<>OLD.month) THEN
   RAISE EXCEPTION 'Indicador e mês do registro não podem ser alterados';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER touch_workspace_metric_period BEFORE INSERT OR UPDATE ON public.workspace_objective_metric_periods
 FOR EACH ROW EXECUTE FUNCTION public.touch_workspace_metric_period();
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_objective_metric_periods;
 END IF;
END $$;
COMMIT;
