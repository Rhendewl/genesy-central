BEGIN;
ALTER TABLE public.crm_pipelines ADD COLUMN default_assignee_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;
CREATE FUNCTION public.validate_pipeline_default_assignee() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.default_assignee_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.id = NEW.default_assignee_id
      AND p.owner_id = NEW.user_id AND p.is_active AND p.auth_user_id IS NOT NULL
  ) THEN RAISE EXCEPTION 'Escolha um responsável ativo deste workspace, com acesso ao sistema'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER zzzz_validate_pipeline_default_assignee BEFORE INSERT OR UPDATE OF default_assignee_id,user_id ON public.crm_pipelines
FOR EACH ROW EXECUTE FUNCTION public.validate_pipeline_default_assignee();
CREATE FUNCTION public.assign_pipeline_default_responsible() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_pipeline uuid; target_assignee uuid;
BEGIN
  IF NEW.assigned_to IS NOT NULL THEN RETURN NEW; END IF;
  target_pipeline := NEW.pipeline_id;
  IF target_pipeline IS NULL AND NEW.stage_id IS NOT NULL THEN
    SELECT pipeline_id INTO target_pipeline FROM public.crm_stages WHERE id=NEW.stage_id AND user_id=NEW.user_id;
  END IF;
  SELECT default_assignee_id INTO target_assignee FROM public.crm_pipelines WHERE id=target_pipeline AND user_id=NEW.user_id;
  IF target_assignee IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=target_assignee AND p.owner_id=NEW.user_id AND p.is_active AND p.auth_user_id IS NOT NULL)
    THEN RAISE EXCEPTION 'O responsável padrão está indisponível. Atualize o responsável da pipeline'; END IF;
    NEW.assigned_to := target_assignee;
  END IF;
  RETURN NEW;
END $$;
-- Last BEFORE INSERT trigger: owner/stage normalization has completed. All
-- AFTER INSERT notifications and activity snapshots see the assigned owner.
CREATE TRIGGER zzzz_assign_pipeline_default_responsible BEFORE INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.assign_pipeline_default_responsible();
REVOKE ALL ON FUNCTION public.validate_pipeline_default_assignee() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_pipeline_default_responsible() FROM PUBLIC;

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
      AND (profile.crm_pipeline_id = v_pipeline_id OR profile.role = 'admin' OR profile.auth_user_id = v_owner_id OR lower(profile.job_title) IN ('socio','sócio'))
      AND profile.is_active;
    IF v_assignee_id IS NULL THEN RAISE EXCEPTION 'ASSIGNEE_NOT_IN_PIPELINE'; END IF;
  ELSE
    SELECT profile.id INTO v_assignee_id
    FROM public.crm_pipelines pipeline JOIN public.user_profiles profile ON profile.id=pipeline.default_assignee_id
    WHERE pipeline.id=v_pipeline_id AND pipeline.user_id=v_owner_id AND profile.owner_id=v_owner_id AND profile.is_active AND profile.auth_user_id IS NOT NULL;
    IF v_assignee_id IS NULL THEN
      SELECT profile.id INTO v_assignee_id FROM public.user_profiles profile
      WHERE profile.owner_id=v_owner_id AND profile.crm_pipeline_id=v_pipeline_id AND profile.is_active
      ORDER BY profile.created_at LIMIT 1;
    END IF;
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


COMMIT;
