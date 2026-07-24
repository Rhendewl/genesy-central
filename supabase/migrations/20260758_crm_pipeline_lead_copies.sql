-- CRM: representações independentes do mesmo lead em pipelines diferentes.
-- canonical_lead_id é a identidade lógica usada nas contagens; cada linha em
-- leads continua sendo um card operacional, com etapa/responsável/notas próprios.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS canonical_lead_id uuid,
  ADD COLUMN IF NOT EXISTS is_pipeline_copy boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS copied_from_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

UPDATE public.leads
SET canonical_lead_id = id
WHERE canonical_lead_id IS NULL;

ALTER TABLE public.leads
  ALTER COLUMN canonical_lead_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS leads_canonical_lead_idx
  ON public.leads (user_id, canonical_lead_id);

CREATE UNIQUE INDEX IF NOT EXISTS leads_canonical_pipeline_uidx
  ON public.leads (user_id, canonical_lead_id, pipeline_id)
  WHERE pipeline_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.crm_set_lead_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.canonical_lead_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.leads existing
    WHERE existing.user_id = NEW.user_id
      AND (existing.id = NEW.canonical_lead_id OR existing.canonical_lead_id = NEW.canonical_lead_id)
  ) THEN
    NEW.canonical_lead_id := NEW.id;
  END IF;

  NEW.is_pipeline_copy := NEW.canonical_lead_id <> NEW.id;
  IF NOT NEW.is_pipeline_copy THEN
    NEW.copied_from_lead_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_set_lead_identity ON public.leads;
CREATE TRIGGER trg_crm_set_lead_identity
  BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.crm_set_lead_identity();

CREATE OR REPLACE FUNCTION public.crm_copy_lead_to_pipeline(
  p_lead_id uuid,
  p_stage_id uuid,
  p_note text DEFAULT NULL,
  p_assignee_id uuid DEFAULT NULL
)
RETURNS TABLE (
  lead_id uuid,
  canonical_lead_id uuid,
  pipeline_id uuid,
  stage_id uuid,
  already_exists boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_id uuid := public.effective_owner_id();
  v_source public.leads%ROWTYPE;
  v_pipeline_id uuid;
  v_legacy_column text;
  v_require_note boolean;
  v_assignee_id uuid;
  v_copy_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT lead.* INTO v_source
  FROM public.leads lead
  WHERE lead.id = p_lead_id
    AND lead.user_id = v_owner_id
    AND public.can_access_crm_pipeline(lead.pipeline_id)
    AND public.can_view_lead(lead.assigned_to);

  IF NOT FOUND THEN RAISE EXCEPTION 'LEAD_NOT_FOUND'; END IF;

  SELECT stage.pipeline_id, stage.legacy_column, stage.require_note
  INTO v_pipeline_id, v_legacy_column, v_require_note
  FROM public.crm_stages stage
  WHERE stage.id = p_stage_id
    AND stage.user_id = v_owner_id
    AND stage.is_active
    AND public.can_access_crm_pipeline(stage.pipeline_id);

  IF NOT FOUND THEN RAISE EXCEPTION 'STAGE_NOT_FOUND'; END IF;
  IF v_require_note AND NULLIF(btrim(p_note), '') IS NULL THEN
    RAISE EXCEPTION 'NOTE_REQUIRED';
  END IF;

  SELECT lead.id INTO v_existing_id
  FROM public.leads lead
  WHERE lead.user_id = v_owner_id
    AND lead.canonical_lead_id = v_source.canonical_lead_id
    AND lead.pipeline_id = v_pipeline_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN QUERY SELECT v_existing_id, v_source.canonical_lead_id, v_pipeline_id, p_stage_id, true;
    RETURN;
  END IF;

  IF p_assignee_id IS NOT NULL THEN
    SELECT profile.id INTO v_assignee_id
    FROM public.user_profiles profile
    WHERE profile.id = p_assignee_id
      AND profile.owner_id = v_owner_id
      AND profile.crm_pipeline_id = v_pipeline_id
      AND profile.is_active;
    IF v_assignee_id IS NULL THEN RAISE EXCEPTION 'ASSIGNEE_NOT_IN_PIPELINE'; END IF;
  ELSE
    SELECT profile.id INTO v_assignee_id
    FROM public.user_profiles profile
    WHERE profile.owner_id = v_owner_id
      AND profile.crm_pipeline_id = v_pipeline_id
      AND profile.is_active
    ORDER BY profile.created_at
    LIMIT 1;
  END IF;

  INSERT INTO public.leads (
    user_id, name, contact, email, source, page_id, leadgen_id,
    campaign_name, ad_name, form_id, form_name, is_duplicate,
    kanban_column, pipeline_id, stage_id, assigned_to, tags, notes,
    integration_notes, deal_value, entered_at, iq_score, ie_score,
    canonical_lead_id, is_pipeline_copy, copied_from_lead_id
  ) VALUES (
    v_source.user_id, v_source.name, v_source.contact, v_source.email,
    v_source.source, v_source.page_id, NULL,
    v_source.campaign_name, v_source.ad_name, v_source.form_id, v_source.form_name,
    v_source.is_duplicate, COALESCE(v_legacy_column, v_source.kanban_column),
    v_pipeline_id, p_stage_id, v_assignee_id, v_source.tags, v_source.notes,
    v_source.integration_notes, v_source.deal_value, v_source.entered_at,
    v_source.iq_score, NULL, v_source.canonical_lead_id, true, v_source.id
  )
  RETURNING id INTO v_copy_id;

  -- O trigger de atividades registra todo INSERT. A cópia é reclassificada
  -- para não entrar novamente na métrica de leads criados.
  UPDATE public.crm_activity_log
  SET event_type = 'lead_pipeline_copied',
      metadata = metadata || jsonb_build_object(
        'canonical_lead_id', v_source.canonical_lead_id,
        'copied_from_lead_id', v_source.id,
        'source_pipeline_id', v_source.pipeline_id,
        'target_pipeline_id', v_pipeline_id
      )
  WHERE source_record_id = v_copy_id
    AND event_type = 'lead_created';

  INSERT INTO public.crm_lead_stage_history (
    lead_id, pipeline_id, stage_id, from_column, to_column, moved_by, note
  ) VALUES (
    v_copy_id, v_pipeline_id, p_stage_id, NULL, v_legacy_column, auth.uid(), NULLIF(btrim(p_note), '')
  );

  RETURN QUERY SELECT v_copy_id, v_source.canonical_lead_id, v_pipeline_id, p_stage_id, false;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_copy_lead_to_pipeline(uuid, uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_copy_lead_to_pipeline(uuid, uuid, text, uuid) TO authenticated;

COMMENT ON COLUMN public.leads.canonical_lead_id IS
  'Identidade lógica do lead; compartilhada por seus cards em pipelines diferentes.';
COMMENT ON COLUMN public.leads.is_pipeline_copy IS
  'Indica que a linha é uma representação operacional adicional do mesmo lead.';
