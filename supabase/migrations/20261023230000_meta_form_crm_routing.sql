BEGIN;
-- Preserve only pre-existing page-wide capture. Newly connected pages require explicit form configuration.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
    AND table_name = 'meta_page_subscriptions' AND column_name = 'capture_unconfigured_forms') THEN
    ALTER TABLE public.meta_page_subscriptions ADD COLUMN capture_unconfigured_forms boolean NOT NULL DEFAULT false;
    UPDATE public.meta_page_subscriptions p SET capture_unconfigured_forms = true
    WHERE NOT EXISTS (SELECT 1 FROM public.meta_form_subscriptions f WHERE f.user_id = p.user_id AND f.page_id = p.meta_page_id);
  END IF;
END $$;
ALTER TABLE public.meta_form_subscriptions
  ADD COLUMN IF NOT EXISTS crm_pipeline_id uuid REFERENCES public.crm_pipelines(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS crm_stage_id uuid REFERENCES public.crm_stages(id) ON DELETE RESTRICT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS meta_form_answers jsonb;
-- A Meta event is unique within its owner, not across independent organizations.
CREATE UNIQUE INDEX IF NOT EXISTS leads_owner_leadgen_unique ON public.leads(user_id, leadgen_id) WHERE leadgen_id IS NOT NULL;
DROP INDEX IF EXISTS public.leads_leadgen_id_unique;

CREATE OR REPLACE FUNCTION public.validate_meta_form_destination() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (NEW.crm_pipeline_id IS NULL) <> (NEW.crm_stage_id IS NULL) THEN
    RAISE EXCEPTION 'Selecione o CRM e a etapa juntos';
  END IF;
  IF NEW.crm_stage_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.crm_stages s JOIN public.crm_pipelines p ON p.id = s.pipeline_id
    WHERE s.id = NEW.crm_stage_id AND p.id = NEW.crm_pipeline_id
      AND p.user_id = NEW.user_id AND p.is_active AND s.is_active
  ) THEN RAISE EXCEPTION 'Destino do CRM inválido'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.meta_page_subscriptions p
    WHERE p.user_id = NEW.user_id AND p.meta_page_id = NEW.page_id) THEN
    RAISE EXCEPTION 'Página Meta não pertence à conta';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS validate_meta_form_destination ON public.meta_form_subscriptions;
CREATE TRIGGER validate_meta_form_destination BEFORE INSERT OR UPDATE OF user_id, page_id, crm_pipeline_id, crm_stage_id
ON public.meta_form_subscriptions FOR EACH ROW EXECUTE FUNCTION public.validate_meta_form_destination();
ALTER TABLE public.meta_form_subscriptions ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE policy record; BEGIN
  FOR policy IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'meta_form_subscriptions'
  LOOP EXECUTE format('DROP POLICY %I ON public.meta_form_subscriptions', policy.policyname); END LOOP;
END $$;
CREATE POLICY users_own_form_subs ON public.meta_form_subscriptions FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE OR REPLACE FUNCTION public.increment_meta_form_capture() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.meta_form_subscriptions SET leads_count = COALESCE(leads_count, 0) + 1,
    last_lead_at = now() WHERE user_id = NEW.user_id AND page_id = NEW.page_id AND form_id = NEW.form_id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.increment_meta_form_capture() FROM PUBLIC;
DROP TRIGGER IF EXISTS increment_meta_form_capture ON public.leads;
CREATE TRIGGER increment_meta_form_capture AFTER INSERT ON public.leads
FOR EACH ROW WHEN (NEW.leadgen_id IS NOT NULL) EXECUTE FUNCTION public.increment_meta_form_capture();
-- Webhook payloads are written only by trusted server code. Users may read their own logs.
ALTER TABLE public.meta_webhook_logs ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE policy record; BEGIN
  FOR policy IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'meta_webhook_logs'
  LOOP EXECUTE format('DROP POLICY %I ON public.meta_webhook_logs', policy.policyname); END LOOP;
END $$;
CREATE POLICY meta_webhook_owner_read ON public.meta_webhook_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
COMMIT;
