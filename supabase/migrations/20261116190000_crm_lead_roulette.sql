BEGIN;
CREATE TABLE public.crm_lead_roulettes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
 source_kind text NOT NULL CHECK (source_kind IN ('genesy','meta')), form_id text NOT NULL,
 page_id text NOT NULL DEFAULT '', stage_ids uuid[] NOT NULL CHECK (cardinality(stage_ids) BETWEEN 1 AND 100),
 enabled boolean NOT NULL DEFAULT true, cursor_position integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,source_kind,form_id,page_id)
);
CREATE TABLE public.crm_lead_distribution (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), roulette_id uuid NOT NULL REFERENCES public.crm_lead_roulettes(id),
 user_id uuid NOT NULL REFERENCES auth.users(id), event_id text NOT NULL,
 payload jsonb NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','distributed')),
 lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
 pipeline_id uuid REFERENCES public.crm_pipelines(id) ON DELETE SET NULL,
 assigned_to uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), distributed_at timestamptz,
 UNIQUE(roulette_id,event_id)
);
ALTER TABLE public.leads ADD COLUMN roulette_id uuid REFERENCES public.crm_lead_roulettes(id);
CREATE INDEX crm_distribution_pending ON public.crm_lead_distribution(roulette_id,created_at) WHERE status='pending';
ALTER TABLE public.crm_lead_roulettes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_lead_distribution ENABLE ROW LEVEL SECURITY;
CREATE POLICY roulette_admin_read ON public.crm_lead_roulettes FOR SELECT TO authenticated
 USING(user_id=public.effective_owner_id() AND public.current_member_has_full_crm_access());
CREATE POLICY distribution_admin_read ON public.crm_lead_distribution FOR SELECT TO authenticated
 USING(user_id=public.effective_owner_id() AND public.current_member_has_full_crm_access());
GRANT SELECT ON public.crm_lead_roulettes,public.crm_lead_distribution TO authenticated;
GRANT ALL ON public.crm_lead_roulettes,public.crm_lead_distribution TO service_role;

-- The pipeline proprietor must be able to open their assigned pipeline.
CREATE OR REPLACE FUNCTION public.can_access_crm_pipeline(p_pipeline_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.current_member_has_full_crm_access() OR EXISTS (
 SELECT 1 FROM public.user_profiles me WHERE me.auth_user_id=auth.uid() AND me.is_active AND (
 me.crm_pipeline_id=p_pipeline_id OR EXISTS(SELECT 1 FROM public.crm_pipelines p
 WHERE p.id=p_pipeline_id AND p.user_id=me.owner_id AND p.default_assignee_id=me.id)))
$$;
-- Existing tenant/pipeline policies still apply. A roulette lead belongs to one recipient.
CREATE POLICY roulette_recipient_only ON public.leads AS RESTRICTIVE FOR ALL TO authenticated
 USING (roulette_id IS NULL OR public.current_member_has_full_crm_access() OR assigned_to IN
 (SELECT id FROM public.user_profiles WHERE auth_user_id=auth.uid() AND is_active))
 WITH CHECK (roulette_id IS NULL OR public.current_member_has_full_crm_access() OR assigned_to IN
 (SELECT id FROM public.user_profiles WHERE auth_user_id=auth.uid() AND is_active));

CREATE FUNCTION public.crm_save_lead_roulette(p_id uuid,p_name text,p_source text,p_form text,p_page text,p_stages uuid[],p_enabled boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE owner uuid:=public.effective_owner_id(); result uuid; n integer;
BEGIN
 IF NOT coalesce(public.current_member_has_full_crm_access(),false) OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Apenas administradores podem configurar roletas'; END IF;
 IF p_source='genesy' THEN
  IF NOT EXISTS(SELECT 1 FROM public.forms WHERE id::text=p_form AND user_id=owner AND deleted_at IS NULL)
   OR coalesce(p_page,'')<>'' THEN RAISE EXCEPTION 'Formulário inválido'; END IF;
 ELSIF p_source='meta' THEN
  IF NOT EXISTS(SELECT 1 FROM public.meta_form_subscriptions WHERE user_id=owner AND form_id=p_form AND page_id=p_page)
   THEN RAISE EXCEPTION 'Configure a captura deste formulário Meta primeiro'; END IF;
 ELSE RAISE EXCEPTION 'Origem inválida'; END IF;
 IF cardinality(p_stages) IS NULL OR cardinality(p_stages) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Selecione as pipelines'; END IF;
 SELECT count(DISTINCT s.pipeline_id) INTO n FROM unnest(p_stages) t(id)
 JOIN public.crm_stages s ON s.id=t.id AND s.user_id=owner AND s.is_active
 JOIN public.crm_pipelines p ON p.id=s.pipeline_id AND p.user_id=owner AND p.is_active
 JOIN public.user_profiles u ON u.id=p.default_assignee_id AND u.owner_id=owner AND u.is_active AND u.auth_user_id IS NOT NULL;
 IF n<>cardinality(p_stages) THEN RAISE EXCEPTION 'Selecione uma etapa por pipeline ativa, com proprietário ativo'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO public.crm_lead_roulettes(user_id,name,source_kind,form_id,page_id,stage_ids,enabled)
  VALUES(owner,btrim(p_name),p_source,p_form,coalesce(p_page,''),p_stages,p_enabled) RETURNING id INTO result;
 ELSE
  UPDATE public.crm_lead_roulettes SET name=btrim(p_name),stage_ids=p_stages,enabled=p_enabled,
   cursor_position=CASE WHEN stage_ids=p_stages THEN cursor_position ELSE 0 END
  WHERE id=p_id AND user_id=owner AND source_kind=p_source AND form_id=p_form AND page_id=coalesce(p_page,'') RETURNING id INTO result;
  IF result IS NULL THEN RAISE EXCEPTION 'Roleta não encontrada ou formulário alterado'; END IF;
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.crm_save_lead_roulette(uuid,text,text,text,text,uuid[],boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_save_lead_roulette(uuid,text,text,text,text,uuid[],boolean) TO authenticated;

-- Only trusted ingestion may supply a payload. Locking the roulette serializes
-- deliveries; cursor, lead, receipt, submission link and history commit together.
CREATE FUNCTION public.crm_distribute_form_lead(p_owner uuid,p_source text,p_form text,p_page text,p_event text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.crm_lead_roulettes%ROWTYPE; receipt public.crm_lead_distribution%ROWTYPE;
 dest record; pos integer; offset_n integer; new_id uuid; existing_id uuid; lead public.leads%ROWTYPE;
BEGIN
 SELECT * INTO r FROM public.crm_lead_roulettes WHERE user_id=p_owner AND source_kind=p_source
 AND form_id=p_form AND page_id=coalesce(p_page,'') FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('matched',false); END IF;
 IF nullif(p_event,'') IS NULL THEN RAISE EXCEPTION 'Evento obrigatório'; END IF;
 IF p_source='genesy' THEN
  SELECT lead_id INTO existing_id FROM public.form_submissions WHERE id::text=p_event AND user_id=p_owner AND form_id::text=p_form FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submissão inválida'; END IF;
 ELSE
  SELECT id INTO existing_id FROM public.leads WHERE user_id=p_owner AND leadgen_id=p_event;
 END IF;
 IF existing_id IS NOT NULL THEN RETURN jsonb_build_object('matched',true,'status','duplicate','lead_id',existing_id); END IF;
 SELECT * INTO receipt FROM public.crm_lead_distribution WHERE roulette_id=r.id AND event_id=p_event;
 IF FOUND AND receipt.status='distributed' THEN
  RETURN jsonb_build_object('matched',true,'status','duplicate','lead_id',receipt.lead_id);
 END IF;
 IF p_payload IS NULL THEN
  IF receipt.id IS NULL THEN RAISE EXCEPTION 'Entrada pendente não encontrada'; END IF;
  p_payload:=receipt.payload;
 END IF;
 INSERT INTO public.crm_lead_distribution(roulette_id,user_id,event_id,payload)
 VALUES(r.id,p_owner,p_event,p_payload)
 ON CONFLICT(roulette_id,event_id) DO UPDATE SET payload=excluded.payload RETURNING * INTO receipt;
 IF NOT r.enabled THEN RETURN jsonb_build_object('matched',true,'status','pending'); END IF;
 FOR offset_n IN 0..cardinality(r.stage_ids)-1 LOOP
  pos:=(r.cursor_position+offset_n)%cardinality(r.stage_ids);
  SELECT s.id,s.pipeline_id,s.legacy_column,s.order_index,p.default_assignee_id INTO dest
  FROM public.crm_stages s JOIN public.crm_pipelines p ON p.id=s.pipeline_id
  JOIN public.user_profiles u ON u.id=p.default_assignee_id
  WHERE s.id=r.stage_ids[pos+1] AND s.user_id=p_owner AND s.is_active AND p.user_id=p_owner AND p.is_active
   AND u.owner_id=p_owner AND u.is_active AND u.auth_user_id IS NOT NULL
  FOR SHARE OF s,p,u;
  EXIT WHEN FOUND;
 END LOOP;
 IF dest.id IS NULL THEN RETURN jsonb_build_object('matched',true,'status','pending'); END IF;
 lead:=jsonb_populate_record(NULL::public.leads,p_payload);
 INSERT INTO public.leads(user_id,name,contact,email,source,form_id,form_name,page_id,leadgen_id,
 campaign_name,ad_name,meta_form_answers,origin_id,tags,deal_value,integration_notes,entered_at,received_at,
 iq_score,ie_score,is_duplicate,pipeline_id,stage_id,kanban_column,assigned_to,roulette_id)
 VALUES(p_owner,coalesce(lead.name,'Lead'),coalesce(lead.contact,''),lead.email,lead.source,p_form,lead.form_name,
 nullif(p_page,''),CASE WHEN p_source='meta' THEN p_event ELSE NULL END,
 lead.campaign_name,lead.ad_name,lead.meta_form_answers,lead.origin_id,coalesce(lead.tags,'{}'),coalesce(lead.deal_value,0),lead.integration_notes,
 coalesce(lead.entered_at,current_date),coalesce(lead.received_at,now()),lead.iq_score,
 least(100,greatest(0,round((dest.order_index+1)*100.0/greatest(1,(SELECT count(*) FROM public.crm_stages WHERE pipeline_id=dest.pipeline_id AND is_active))))),
 coalesce(lead.is_duplicate,false),dest.pipeline_id,dest.id,coalesce(dest.legacy_column,'abordados'),dest.default_assignee_id,r.id)
 RETURNING id INTO new_id;
 INSERT INTO public.crm_lead_stage_history(lead_id,pipeline_id,stage_id,from_column,to_column,moved_by,note)
 VALUES(new_id,dest.pipeline_id,dest.id,NULL,dest.legacy_column,NULL,'Distribuído pela roleta: '||r.name);
 UPDATE public.crm_lead_roulettes SET cursor_position=(pos+1)%cardinality(r.stage_ids) WHERE id=r.id;
 UPDATE public.crm_lead_distribution SET status='distributed',lead_id=new_id,pipeline_id=dest.pipeline_id,
 assigned_to=dest.default_assignee_id,distributed_at=now() WHERE id=receipt.id;
 IF p_source='genesy' THEN UPDATE public.form_submissions SET lead_id=new_id WHERE id::text=p_event AND user_id=p_owner; END IF;
 RETURN jsonb_build_object('matched',true,'status','distributed','lead_id',new_id,'pipeline_id',dest.pipeline_id,'stage_id',dest.id);
END $$;
REVOKE ALL ON FUNCTION public.crm_distribute_form_lead(uuid,text,text,text,text,jsonb) FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_distribute_form_lead(uuid,text,text,text,text,jsonb) TO service_role;
-- Copy RPC uses SECURITY DEFINER; enforce recipient isolation there as well.
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
    AND public.can_view_lead(lead.assigned_to)
    AND (lead.roulette_id IS NULL OR public.current_member_has_full_crm_access() OR EXISTS (
      SELECT 1 FROM public.user_profiles me WHERE me.auth_user_id=auth.uid() AND me.is_active AND me.id=lead.assigned_to
    ));

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



CREATE FUNCTION public.protect_roulette_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NOT coalesce(public.current_member_has_full_crm_access(),false)
 AND OLD.roulette_id IS NOT NULL AND
 (NEW.roulette_id IS DISTINCT FROM OLD.roulette_id OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
 OR NEW.pipeline_id IS DISTINCT FROM OLD.pipeline_id OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
 RAISE EXCEPTION 'Apenas administradores podem transferir leads distribuídos pela roleta';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_roulette_assignment() FROM PUBLIC;
CREATE TRIGGER zzzzz_protect_roulette_assignment BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.protect_roulette_assignment();
COMMIT;
