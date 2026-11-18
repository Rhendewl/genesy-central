BEGIN;
ALTER TABLE public.crm_lead_roulettes ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
-- Replace only the original uniqueness rule; preserve all other constraints.
DO $$ DECLARE constraint_name text; BEGIN
 SELECT c.conname INTO constraint_name FROM pg_constraint c
 WHERE c.conrelid='public.crm_lead_roulettes'::regclass AND c.contype='u'
 AND (SELECT array_agg(a.attname::text ORDER BY a.attname) FROM unnest(c.conkey) k(attnum)
 JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum)
 = ARRAY['form_id','page_id','source_kind','user_id']::text[];
 IF constraint_name IS NOT NULL THEN
 EXECUTE format('ALTER TABLE public.crm_lead_roulettes DROP CONSTRAINT %I',constraint_name);
 END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS crm_roulette_live_form ON public.crm_lead_roulettes(user_id,source_kind,form_id,page_id) WHERE deleted_at IS NULL;
CREATE OR REPLACE FUNCTION public.crm_save_lead_roulette(p_id uuid,p_name text,p_source text,p_form text,p_page text,p_stages uuid[],p_enabled boolean)
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
  WHERE deleted_at IS NULL AND id=p_id AND user_id=owner AND source_kind=p_source AND form_id=p_form AND page_id=coalesce(p_page,'') RETURNING id INTO result;
  IF result IS NULL THEN RAISE EXCEPTION 'Roleta não encontrada ou formulário alterado'; END IF;
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.crm_save_lead_roulette(uuid,text,text,text,text,uuid[],boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_save_lead_roulette(uuid,text,text,text,text,uuid[],boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_distribute_form_lead(p_owner uuid,p_source text,p_form text,p_page text,p_event text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.crm_lead_roulettes%ROWTYPE; receipt public.crm_lead_distribution%ROWTYPE;
 dest record; pos integer; offset_n integer; new_id uuid; existing_id uuid; lead public.leads%ROWTYPE;
BEGIN
 SELECT * INTO r FROM public.crm_lead_roulettes WHERE deleted_at IS NULL AND user_id=p_owner AND source_kind=p_source
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
CREATE OR REPLACE FUNCTION public.crm_set_roulette_state(p_id uuid,p_enabled boolean DEFAULT NULL,p_delete boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.crm_lead_roulettes%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.current_member_has_full_crm_access(),false) THEN RAISE EXCEPTION 'Apenas administradores podem gerenciar roletas'; END IF;
 SELECT * INTO r FROM public.crm_lead_roulettes WHERE id=p_id AND user_id=public.effective_owner_id() AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Roleta não encontrada'; END IF;
 IF p_delete AND EXISTS(SELECT 1 FROM public.crm_lead_distribution WHERE roulette_id=r.id AND status='pending') THEN
 RAISE EXCEPTION 'Esta roleta tem entradas pendentes. Reprocesse-as antes de excluir'; END IF;
 UPDATE public.crm_lead_roulettes SET enabled=CASE WHEN p_delete THEN false ELSE coalesce(p_enabled,enabled) END,
 deleted_at=CASE WHEN p_delete THEN now() ELSE NULL END WHERE id=r.id;
END $$;
REVOKE ALL ON FUNCTION public.crm_set_roulette_state(uuid,boolean,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_set_roulette_state(uuid,boolean,boolean) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
