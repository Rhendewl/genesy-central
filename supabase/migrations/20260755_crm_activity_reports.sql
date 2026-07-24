-- CRM — histórico imutável para relatórios de atividade e notas.
-- Preserva snapshots mesmo quando o lead, etapa ou usuário forem removidos.

CREATE TABLE IF NOT EXISTS public.crm_activity_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id           uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  pipeline_id       uuid REFERENCES public.crm_pipelines(id) ON DELETE SET NULL,
  stage_id          uuid REFERENCES public.crm_stages(id) ON DELETE SET NULL,
  actor_user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to       uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  event_type        text NOT NULL,
  lead_name         text NOT NULL,
  lead_contact      text,
  source            text,
  deal_value        numeric(14,2) NOT NULL DEFAULT 0,
  from_stage_name   text,
  to_stage_name     text,
  note_content      text,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_record_id  uuid,
  occurred_at       timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_activity_log_owner_date_idx
  ON public.crm_activity_log (owner_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS crm_activity_log_pipeline_date_idx
  ON public.crm_activity_log (pipeline_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS crm_activity_log_actor_date_idx
  ON public.crm_activity_log (actor_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS crm_activity_log_assignee_date_idx
  ON public.crm_activity_log (assigned_to, occurred_at DESC);
CREATE INDEX IF NOT EXISTS crm_activity_log_lead_date_idx
  ON public.crm_activity_log (lead_id, occurred_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS crm_activity_log_source_uidx
  ON public.crm_activity_log (event_type, source_record_id)
  WHERE source_record_id IS NOT NULL;

ALTER TABLE public.crm_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_activity_log_select" ON public.crm_activity_log;
CREATE POLICY "crm_activity_log_select"
ON public.crm_activity_log FOR SELECT
USING (
  owner_user_id = public.effective_owner_id()
  AND (pipeline_id IS NULL OR public.can_access_crm_pipeline(pipeline_id))
);

COMMENT ON TABLE public.crm_activity_log IS
  'Log imutável de atividades do CRM usado por relatórios; snapshots sobrevivem à exclusão do lead.';

CREATE OR REPLACE FUNCTION public.crm_log_lead_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_from_stage text;
  v_to_stage text;
  v_old_assignee text;
  v_new_assignee text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT name INTO v_to_stage FROM public.crm_stages WHERE id = NEW.stage_id;
    INSERT INTO public.crm_activity_log (
      owner_user_id, lead_id, pipeline_id, stage_id, actor_user_id, assigned_to,
      event_type, lead_name, lead_contact, source, deal_value, to_stage_name,
      metadata, source_record_id, occurred_at
    ) VALUES (
      NEW.user_id, NEW.id, NEW.pipeline_id, NEW.stage_id, v_actor, NEW.assigned_to,
      'lead_created', NEW.name, NEW.contact, NEW.source, COALESCE(NEW.deal_value, 0), v_to_stage,
      jsonb_build_object('campaign_name', NEW.campaign_name, 'form_name', NEW.form_name),
      NEW.id, COALESCE(NEW.created_at, now())
    ) ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT name INTO v_from_stage FROM public.crm_stages WHERE id = OLD.stage_id;
    INSERT INTO public.crm_activity_log (
      owner_user_id, lead_id, pipeline_id, stage_id, actor_user_id, assigned_to,
      event_type, lead_name, lead_contact, source, deal_value, from_stage_name, occurred_at
    ) VALUES (
      OLD.user_id, NULL, OLD.pipeline_id, OLD.stage_id, v_actor, OLD.assigned_to,
      'lead_deleted', OLD.name, OLD.contact, OLD.source, COALESCE(OLD.deal_value, 0), v_from_stage, now()
    );
    RETURN OLD;
  END IF;

  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    SELECT name INTO v_from_stage FROM public.crm_stages WHERE id = OLD.stage_id;
    SELECT name INTO v_to_stage FROM public.crm_stages WHERE id = NEW.stage_id;
    INSERT INTO public.crm_activity_log (
      owner_user_id, lead_id, pipeline_id, stage_id, actor_user_id, assigned_to,
      event_type, lead_name, lead_contact, source, deal_value,
      from_stage_name, to_stage_name, metadata, occurred_at
    ) VALUES (
      NEW.user_id, NEW.id, NEW.pipeline_id, NEW.stage_id, v_actor, NEW.assigned_to,
      CASE
        WHEN EXISTS (SELECT 1 FROM public.crm_stages WHERE id = NEW.stage_id AND is_won) THEN 'deal_won'
        WHEN EXISTS (SELECT 1 FROM public.crm_stages WHERE id = NEW.stage_id AND is_lost) THEN 'deal_lost'
        ELSE 'stage_changed'
      END,
      NEW.name, NEW.contact, NEW.source, COALESCE(NEW.deal_value, 0),
      v_from_stage, v_to_stage,
      jsonb_build_object('from_stage_id', OLD.stage_id, 'to_stage_id', NEW.stage_id), now()
    );
  END IF;

  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    SELECT full_name INTO v_old_assignee FROM public.user_profiles WHERE id = OLD.assigned_to;
    SELECT full_name INTO v_new_assignee FROM public.user_profiles WHERE id = NEW.assigned_to;
    INSERT INTO public.crm_activity_log (
      owner_user_id, lead_id, pipeline_id, stage_id, actor_user_id, assigned_to,
      event_type, lead_name, lead_contact, source, deal_value, metadata, occurred_at
    ) VALUES (
      NEW.user_id, NEW.id, NEW.pipeline_id, NEW.stage_id, v_actor, NEW.assigned_to,
      'assignee_changed', NEW.name, NEW.contact, NEW.source, COALESCE(NEW.deal_value, 0),
      jsonb_build_object('from', v_old_assignee, 'to', v_new_assignee), now()
    );
  END IF;

  IF NEW.notes IS DISTINCT FROM OLD.notes THEN
    INSERT INTO public.crm_activity_log (
      owner_user_id, lead_id, pipeline_id, stage_id, actor_user_id, assigned_to,
      event_type, lead_name, lead_contact, source, deal_value, note_content, metadata, occurred_at
    ) VALUES (
      NEW.user_id, NEW.id, NEW.pipeline_id, NEW.stage_id, v_actor, NEW.assigned_to,
      CASE WHEN NEW.notes IS NULL OR btrim(NEW.notes) = '' THEN 'note_deleted'
           WHEN OLD.notes IS NULL OR btrim(OLD.notes) = '' THEN 'note_added'
           ELSE 'note_updated' END,
      NEW.name, NEW.contact, NEW.source, COALESCE(NEW.deal_value, 0),
      COALESCE(NULLIF(btrim(NEW.notes), ''), OLD.notes),
      jsonb_build_object('previous_note', OLD.notes), now()
    );
  END IF;

  IF NEW.tags IS DISTINCT FROM OLD.tags THEN
    INSERT INTO public.crm_activity_log (
      owner_user_id, lead_id, pipeline_id, stage_id, actor_user_id, assigned_to,
      event_type, lead_name, lead_contact, source, deal_value, metadata, occurred_at
    ) VALUES (
      NEW.user_id, NEW.id, NEW.pipeline_id, NEW.stage_id, v_actor, NEW.assigned_to,
      'tags_changed', NEW.name, NEW.contact, NEW.source, COALESCE(NEW.deal_value, 0),
      jsonb_build_object('before', OLD.tags, 'after', NEW.tags), now()
    );
  END IF;

  IF NEW.deal_value IS DISTINCT FROM OLD.deal_value THEN
    INSERT INTO public.crm_activity_log (
      owner_user_id, lead_id, pipeline_id, stage_id, actor_user_id, assigned_to,
      event_type, lead_name, lead_contact, source, deal_value, metadata, occurred_at
    ) VALUES (
      NEW.user_id, NEW.id, NEW.pipeline_id, NEW.stage_id, v_actor, NEW.assigned_to,
      'deal_value_changed', NEW.name, NEW.contact, NEW.source, COALESCE(NEW.deal_value, 0),
      jsonb_build_object('before', OLD.deal_value, 'after', NEW.deal_value), now()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_log_lead_activity ON public.leads;
CREATE TRIGGER trg_crm_log_lead_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.crm_log_lead_activity();

CREATE OR REPLACE FUNCTION public.crm_log_stage_note()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_lead public.leads%ROWTYPE; v_stage text;
BEGIN
  IF NEW.note IS NULL OR btrim(NEW.note) = '' THEN RETURN NEW; END IF;
  SELECT * INTO v_lead FROM public.leads WHERE id = NEW.lead_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT name INTO v_stage FROM public.crm_stages WHERE id = NEW.stage_id;
  INSERT INTO public.crm_activity_log (
    owner_user_id, lead_id, pipeline_id, stage_id, actor_user_id, assigned_to,
    event_type, lead_name, lead_contact, source, deal_value, to_stage_name,
    note_content, source_record_id, occurred_at
  ) VALUES (
    v_lead.user_id, v_lead.id, NEW.pipeline_id, NEW.stage_id, NEW.moved_by,
    v_lead.assigned_to, 'stage_note', v_lead.name, v_lead.contact, v_lead.source,
    COALESCE(v_lead.deal_value, 0), v_stage, NEW.note, NEW.id, NEW.moved_at
  ) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_log_stage_note ON public.crm_lead_stage_history;
CREATE TRIGGER trg_crm_log_stage_note
  AFTER INSERT ON public.crm_lead_stage_history
  FOR EACH ROW EXECUTE FUNCTION public.crm_log_stage_note();

-- Backfill do que é reconstruível com segurança hoje.
INSERT INTO public.crm_activity_log (
  owner_user_id, lead_id, pipeline_id, stage_id, assigned_to, event_type,
  lead_name, lead_contact, source, deal_value, note_content, source_record_id, occurred_at
)
SELECT l.user_id, l.id, l.pipeline_id, l.stage_id, l.assigned_to, 'lead_created',
       l.name, l.contact, l.source, COALESCE(l.deal_value, 0), l.notes, l.id, l.created_at
FROM public.leads l
ON CONFLICT DO NOTHING;

INSERT INTO public.crm_activity_log (
  owner_user_id, lead_id, pipeline_id, stage_id, actor_user_id, assigned_to,
  event_type, lead_name, lead_contact, source, deal_value, from_stage_name,
  to_stage_name, source_record_id, occurred_at
)
SELECT l.user_id, l.id, h.pipeline_id, h.stage_id, h.moved_by, l.assigned_to,
       CASE WHEN COALESCE(s.is_won, false) THEN 'deal_won'
            WHEN COALESCE(s.is_lost, false) THEN 'deal_lost'
            ELSE 'stage_changed' END,
       l.name, l.contact, l.source, COALESCE(l.deal_value, 0),
       h.from_column, COALESCE(s.name, h.to_column), h.id, h.moved_at
FROM public.crm_lead_stage_history h
JOIN public.leads l ON l.id = h.lead_id
LEFT JOIN public.crm_stages s ON s.id = h.stage_id
ON CONFLICT DO NOTHING;

INSERT INTO public.crm_activity_log (
  owner_user_id, lead_id, pipeline_id, stage_id, assigned_to, event_type,
  lead_name, lead_contact, source, deal_value, note_content, source_record_id, occurred_at
)
SELECT l.user_id, l.id, l.pipeline_id, l.stage_id, l.assigned_to, 'note_added',
       l.name, l.contact, l.source, COALESCE(l.deal_value, 0), l.notes, l.id, l.updated_at
FROM public.leads l
WHERE l.notes IS NOT NULL AND btrim(l.notes) <> ''
ON CONFLICT DO NOTHING;

INSERT INTO public.crm_activity_log (
  owner_user_id, lead_id, pipeline_id, stage_id, actor_user_id, assigned_to,
  event_type, lead_name, lead_contact, source, deal_value, to_stage_name,
  note_content, source_record_id, occurred_at
)
SELECT l.user_id, l.id, h.pipeline_id, h.stage_id, h.moved_by, l.assigned_to,
       'stage_note', l.name, l.contact, l.source, COALESCE(l.deal_value, 0),
       s.name, h.note, h.id, h.moved_at
FROM public.crm_lead_stage_history h
JOIN public.leads l ON l.id = h.lead_id
LEFT JOIN public.crm_stages s ON s.id = h.stage_id
WHERE h.note IS NOT NULL AND btrim(h.note) <> ''
ON CONFLICT DO NOTHING;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_activity_log;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
