-- Roletas em "ambientes" (ex.: um por cliente) com várias filas de distribuição.
-- Cada fila tem vários formulários (Genesy e/ou Meta) e seus corretores participantes,
-- cada um com a etapa de entrada onde o lead cai. Um formulário pertence a no máximo uma fila.
BEGIN;
CREATE TABLE IF NOT EXISTS public.crm_roulette_groups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
 created_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz
);
ALTER TABLE public.crm_lead_roulettes
 ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.crm_roulette_groups(id),
 ADD COLUMN IF NOT EXISTS participants jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.crm_lead_roulettes ALTER COLUMN source_kind DROP NOT NULL,
 ALTER COLUMN form_id DROP NOT NULL, ALTER COLUMN stage_ids DROP NOT NULL;
DO $$ DECLARE c text; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.crm_lead_roulettes'::regclass AND contype='c'
   AND pg_get_constraintdef(oid) ILIKE '%stage_ids%' LOOP
  EXECUTE format('ALTER TABLE public.crm_lead_roulettes DROP CONSTRAINT %I', c);
 END LOOP;
END $$;
DROP INDEX IF EXISTS public.crm_roulette_live_form;

CREATE TABLE IF NOT EXISTS public.crm_roulette_forms (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 roulette_id uuid NOT NULL REFERENCES public.crm_lead_roulettes(id) ON DELETE CASCADE,
 source_kind text NOT NULL CHECK (source_kind IN ('genesy','meta')),
 form_id text NOT NULL,
 page_id text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (user_id, source_kind, form_id, page_id)
);
CREATE INDEX IF NOT EXISTS crm_roulette_forms_roulette ON public.crm_roulette_forms(roulette_id);
ALTER TABLE public.crm_lead_distribution
 ADD COLUMN IF NOT EXISTS source_kind text, ADD COLUMN IF NOT EXISTS form_id text, ADD COLUMN IF NOT EXISTS page_id text;

-- Migra as roletas existentes: um ambiente "Roletas" por conta, participantes = proprietários das pipelines.
INSERT INTO public.crm_roulette_groups(user_id, name)
 SELECT DISTINCT r.user_id, 'Roletas' FROM public.crm_lead_roulettes r
 WHERE r.deleted_at IS NULL AND r.group_id IS NULL;
UPDATE public.crm_lead_roulettes r SET group_id = g.id FROM public.crm_roulette_groups g
 WHERE r.group_id IS NULL AND g.user_id = r.user_id AND g.name = 'Roletas' AND g.deleted_at IS NULL;
UPDATE public.crm_lead_roulettes r SET participants = coalesce((
 SELECT jsonb_agg(jsonb_build_object('profile_id', p.default_assignee_id, 'stage_id', s.id) ORDER BY t.ord)
 FROM unnest(r.stage_ids) WITH ORDINALITY t(id, ord)
 JOIN public.crm_stages s ON s.id = t.id JOIN public.crm_pipelines p ON p.id = s.pipeline_id
 WHERE p.default_assignee_id IS NOT NULL), '[]'::jsonb)
 WHERE r.participants = '[]'::jsonb AND r.stage_ids IS NOT NULL;
INSERT INTO public.crm_roulette_forms(user_id, roulette_id, source_kind, form_id, page_id)
 SELECT user_id, id, source_kind, form_id, coalesce(page_id, '') FROM public.crm_lead_roulettes
 WHERE deleted_at IS NULL AND form_id IS NOT NULL AND source_kind IS NOT NULL
 ON CONFLICT DO NOTHING;
UPDATE public.crm_lead_distribution d SET source_kind = r.source_kind, form_id = r.form_id, page_id = r.page_id
 FROM public.crm_lead_roulettes r WHERE r.id = d.roulette_id AND d.form_id IS NULL;

ALTER TABLE public.crm_roulette_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_roulette_forms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS roulette_group_admin_read ON public.crm_roulette_groups;
CREATE POLICY roulette_group_admin_read ON public.crm_roulette_groups FOR SELECT TO authenticated
 USING (user_id = public.effective_owner_id() AND public.current_member_has_full_crm_access());
DROP POLICY IF EXISTS roulette_form_admin_read ON public.crm_roulette_forms;
CREATE POLICY roulette_form_admin_read ON public.crm_roulette_forms FOR SELECT TO authenticated
 USING (user_id = public.effective_owner_id() AND public.current_member_has_full_crm_access());
GRANT SELECT ON public.crm_roulette_groups, public.crm_roulette_forms TO authenticated;
GRANT ALL ON public.crm_roulette_groups, public.crm_roulette_forms TO service_role;

-- Ambiente: criar/renomear e excluir.
CREATE OR REPLACE FUNCTION public.crm_save_roulette_group(p_id uuid, p_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE owner uuid := public.effective_owner_id(); result uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.current_member_has_full_crm_access(), false) THEN RAISE EXCEPTION 'Apenas administradores podem configurar roletas'; END IF;
 IF length(btrim(coalesce(p_name, ''))) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Informe o nome do ambiente'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO public.crm_roulette_groups(user_id, name) VALUES (owner, btrim(p_name)) RETURNING id INTO result;
 ELSE
  UPDATE public.crm_roulette_groups SET name = btrim(p_name) WHERE id = p_id AND user_id = owner AND deleted_at IS NULL RETURNING id INTO result;
  IF result IS NULL THEN RAISE EXCEPTION 'Ambiente não encontrado'; END IF;
 END IF;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.crm_delete_roulette_group(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE owner uuid := public.effective_owner_id();
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.current_member_has_full_crm_access(), false) THEN RAISE EXCEPTION 'Apenas administradores podem configurar roletas'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.crm_roulette_groups WHERE id = p_id AND user_id = owner AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Ambiente não encontrado'; END IF;
 IF EXISTS (SELECT 1 FROM public.crm_lead_distribution d JOIN public.crm_lead_roulettes r ON r.id = d.roulette_id
   WHERE r.group_id = p_id AND d.status = 'pending') THEN RAISE EXCEPTION 'Há leads pendentes neste ambiente. Reprocesse-os antes de excluir'; END IF;
 DELETE FROM public.crm_roulette_forms f USING public.crm_lead_roulettes r WHERE f.roulette_id = r.id AND r.group_id = p_id;
 UPDATE public.crm_lead_roulettes SET enabled = false, deleted_at = now() WHERE group_id = p_id AND deleted_at IS NULL;
 UPDATE public.crm_roulette_groups SET deleted_at = now() WHERE id = p_id;
END $$;

-- Fila: nome, formulários e corretores (cada um com sua etapa de entrada).
CREATE OR REPLACE FUNCTION public.crm_save_roulette_queue(p_id uuid, p_group uuid, p_name text, p_enabled boolean, p_forms jsonb, p_participants jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE owner uuid := public.effective_owner_id(); result uuid; item jsonb; n integer; stages uuid[] := '{}'; old_participants jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.current_member_has_full_crm_access(), false) THEN RAISE EXCEPTION 'Apenas administradores podem configurar roletas'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.crm_roulette_groups WHERE id = p_group AND user_id = owner AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Ambiente não encontrado'; END IF;
 IF length(btrim(coalesce(p_name, ''))) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Informe o nome da fila'; END IF;
 n := jsonb_array_length(coalesce(p_participants, '[]'::jsonb));
 IF n NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Escolha pelo menos um corretor'; END IF;
 IF (SELECT count(DISTINCT x->>'profile_id') FROM jsonb_array_elements(p_participants) x) <> n THEN RAISE EXCEPTION 'Cada corretor só pode aparecer uma vez na fila'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(p_participants) LOOP
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles u WHERE u.id = (item->>'profile_id')::uuid AND u.owner_id = owner AND u.is_active AND u.auth_user_id IS NOT NULL)
   THEN RAISE EXCEPTION 'Um dos corretores não está ativo'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.crm_stages s JOIN public.crm_pipelines p ON p.id = s.pipeline_id
   WHERE s.id = (item->>'stage_id')::uuid AND s.user_id = owner AND s.is_active AND p.user_id = owner AND p.is_active)
   THEN RAISE EXCEPTION 'Escolha uma etapa de entrada ativa para cada corretor'; END IF;
  stages := stages || (item->>'stage_id')::uuid;
 END LOOP;
 IF jsonb_array_length(coalesce(p_forms, '[]'::jsonb)) > 200 THEN RAISE EXCEPTION 'Muitos formulários em uma fila'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(coalesce(p_forms, '[]'::jsonb)) LOOP
  IF item->>'source_kind' = 'genesy' THEN
   IF NOT EXISTS (SELECT 1 FROM public.forms WHERE id::text = item->>'form_id' AND user_id = owner AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Formulário inválido'; END IF;
  ELSIF item->>'source_kind' = 'meta' THEN
   IF NOT EXISTS (SELECT 1 FROM public.meta_form_subscriptions WHERE user_id = owner AND form_id = item->>'form_id' AND page_id = coalesce(item->>'page_id', ''))
    THEN RAISE EXCEPTION 'Configure a captura do formulário Meta antes de colocá-lo na fila'; END IF;
  ELSE RAISE EXCEPTION 'Origem de formulário inválida'; END IF;
 END LOOP;
 IF p_id IS NULL THEN
  INSERT INTO public.crm_lead_roulettes(user_id, group_id, name, enabled, participants, stage_ids)
  VALUES (owner, p_group, btrim(p_name), coalesce(p_enabled, true), p_participants, stages) RETURNING id INTO result;
 ELSE
  SELECT participants INTO old_participants FROM public.crm_lead_roulettes WHERE id = p_id AND user_id = owner AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fila não encontrada'; END IF;
  UPDATE public.crm_lead_roulettes SET group_id = p_group, name = btrim(p_name), enabled = coalesce(p_enabled, true),
   participants = p_participants, stage_ids = stages,
   cursor_position = CASE WHEN old_participants = p_participants THEN cursor_position ELSE 0 END
  WHERE id = p_id RETURNING id INTO result;
 END IF;
 DELETE FROM public.crm_roulette_forms WHERE roulette_id = result;
 BEGIN
  INSERT INTO public.crm_roulette_forms(user_id, roulette_id, source_kind, form_id, page_id)
  SELECT owner, result, x->>'source_kind', x->>'form_id', coalesce(x->>'page_id', '') FROM jsonb_array_elements(coalesce(p_forms, '[]'::jsonb)) x;
 EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Um dos formulários já está em outra fila. Remova-o de lá primeiro';
 END;
 RETURN result;
END $$;

-- Liga/desliga um formulário Meta a uma fila (usado na tela Formulários Meta).
CREATE OR REPLACE FUNCTION public.crm_roulette_set_form(p_roulette uuid, p_source text, p_form text, p_page text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE owner uuid := public.effective_owner_id();
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.current_member_has_full_crm_access(), false) THEN RAISE EXCEPTION 'Apenas administradores podem configurar roletas'; END IF;
 DELETE FROM public.crm_roulette_forms WHERE user_id = owner AND source_kind = p_source AND form_id = p_form AND page_id = coalesce(p_page, '');
 IF p_roulette IS NULL THEN RETURN; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.crm_lead_roulettes WHERE id = p_roulette AND user_id = owner AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Fila não encontrada'; END IF;
 INSERT INTO public.crm_roulette_forms(user_id, roulette_id, source_kind, form_id, page_id) VALUES (owner, p_roulette, p_source, p_form, coalesce(p_page, ''));
END $$;

CREATE OR REPLACE FUNCTION public.crm_set_roulette_state(p_id uuid, p_enabled boolean DEFAULT NULL, p_delete boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r public.crm_lead_roulettes%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.current_member_has_full_crm_access(), false) THEN RAISE EXCEPTION 'Apenas administradores podem gerenciar roletas'; END IF;
 SELECT * INTO r FROM public.crm_lead_roulettes WHERE id = p_id AND user_id = public.effective_owner_id() AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Fila não encontrada'; END IF;
 IF p_delete AND EXISTS (SELECT 1 FROM public.crm_lead_distribution WHERE roulette_id = r.id AND status = 'pending') THEN
  RAISE EXCEPTION 'Esta fila tem leads pendentes. Reprocesse-os antes de excluir'; END IF;
 IF p_delete THEN DELETE FROM public.crm_roulette_forms WHERE roulette_id = r.id; END IF;
 UPDATE public.crm_lead_roulettes SET enabled = CASE WHEN p_delete THEN false ELSE coalesce(p_enabled, enabled) END,
  deleted_at = CASE WHEN p_delete THEN now() ELSE NULL END WHERE id = r.id;
END $$;

-- Distribuição: acha a fila do formulário e entrega ao próximo corretor disponível.
CREATE OR REPLACE FUNCTION public.crm_distribute_form_lead(p_owner uuid, p_source text, p_form text, p_page text, p_event text, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r public.crm_lead_roulettes%ROWTYPE; receipt public.crm_lead_distribution%ROWTYPE;
 dest_id uuid; dest_pipeline uuid; dest_legacy text; dest_order integer; agent uuid; pos integer; offset_n integer; total integer; new_id uuid; existing_id uuid; lead public.leads%ROWTYPE; item jsonb;
BEGIN
 SELECT rl.* INTO r FROM public.crm_roulette_forms f JOIN public.crm_lead_roulettes rl ON rl.id = f.roulette_id
 WHERE f.user_id = p_owner AND f.source_kind = p_source AND f.form_id = p_form AND f.page_id = coalesce(p_page, '') AND rl.deleted_at IS NULL
 FOR UPDATE OF rl;
 IF NOT FOUND AND p_payload IS NULL THEN
  -- Reprocessamento de uma entrada pendente cujo formulário saiu da fila.
  SELECT rl.* INTO r FROM public.crm_lead_distribution d JOIN public.crm_lead_roulettes rl ON rl.id = d.roulette_id
  WHERE d.user_id = p_owner AND d.event_id = p_event AND d.status = 'pending' AND rl.deleted_at IS NULL LIMIT 1 FOR UPDATE OF rl;
 END IF;
 IF r.id IS NULL THEN RETURN jsonb_build_object('matched', false); END IF;
 IF nullif(p_event, '') IS NULL THEN RAISE EXCEPTION 'Evento obrigatório'; END IF;
 IF p_source = 'genesy' THEN
  SELECT lead_id INTO existing_id FROM public.form_submissions WHERE id::text = p_event AND user_id = p_owner AND form_id::text = p_form FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submissão inválida'; END IF;
 ELSE
  SELECT id INTO existing_id FROM public.leads WHERE user_id = p_owner AND leadgen_id = p_event;
 END IF;
 IF existing_id IS NOT NULL THEN RETURN jsonb_build_object('matched', true, 'status', 'duplicate', 'lead_id', existing_id); END IF;
 SELECT * INTO receipt FROM public.crm_lead_distribution WHERE roulette_id = r.id AND event_id = p_event;
 IF FOUND AND receipt.status = 'distributed' THEN RETURN jsonb_build_object('matched', true, 'status', 'duplicate', 'lead_id', receipt.lead_id); END IF;
 IF p_payload IS NULL THEN
  IF receipt.id IS NULL THEN RAISE EXCEPTION 'Entrada pendente não encontrada'; END IF;
  p_payload := receipt.payload;
 END IF;
 INSERT INTO public.crm_lead_distribution(roulette_id, user_id, event_id, payload, source_kind, form_id, page_id)
 VALUES (r.id, p_owner, p_event, p_payload, p_source, p_form, coalesce(p_page, ''))
 ON CONFLICT (roulette_id, event_id) DO UPDATE SET payload = excluded.payload RETURNING * INTO receipt;
 IF NOT r.enabled THEN RETURN jsonb_build_object('matched', true, 'status', 'pending'); END IF;
 total := jsonb_array_length(r.participants);
 IF total = 0 THEN RETURN jsonb_build_object('matched', true, 'status', 'pending'); END IF;
 FOR offset_n IN 0..total - 1 LOOP
  pos := (r.cursor_position + offset_n) % total;
  item := r.participants -> pos;
  SELECT u.id INTO agent FROM public.user_profiles u
   WHERE u.id = (item->>'profile_id')::uuid AND u.owner_id = p_owner AND u.is_active AND u.auth_user_id IS NOT NULL;
  SELECT s.id, s.pipeline_id, s.legacy_column, s.order_index INTO dest_id, dest_pipeline, dest_legacy, dest_order
   FROM public.crm_stages s JOIN public.crm_pipelines p ON p.id = s.pipeline_id
   WHERE s.id = (item->>'stage_id')::uuid AND s.user_id = p_owner AND s.is_active AND p.user_id = p_owner AND p.is_active
   FOR SHARE OF s, p;
  EXIT WHEN agent IS NOT NULL AND dest_id IS NOT NULL;
  agent := NULL; dest_id := NULL;
 END LOOP;
 IF agent IS NULL OR dest_id IS NULL THEN RETURN jsonb_build_object('matched', true, 'status', 'pending'); END IF;
 lead := jsonb_populate_record(NULL::public.leads, p_payload);
 INSERT INTO public.leads(user_id, name, contact, email, source, form_id, form_name, page_id, leadgen_id,
  campaign_name, ad_name, meta_form_answers, origin_id, tags, deal_value, integration_notes, entered_at, received_at,
  iq_score, ie_score, is_duplicate, pipeline_id, stage_id, kanban_column, assigned_to, roulette_id)
 VALUES (p_owner, coalesce(lead.name, 'Lead'), coalesce(lead.contact, ''), lead.email, lead.source, p_form, lead.form_name,
  nullif(p_page, ''), CASE WHEN p_source = 'meta' THEN p_event ELSE NULL END,
  lead.campaign_name, lead.ad_name, lead.meta_form_answers, lead.origin_id, coalesce(lead.tags, '{}'), coalesce(lead.deal_value, 0), lead.integration_notes,
  coalesce(lead.entered_at, current_date), coalesce(lead.received_at, now()), lead.iq_score,
  least(100, greatest(0, round((dest_order + 1) * 100.0 / greatest(1, (SELECT count(*) FROM public.crm_stages WHERE pipeline_id = dest_pipeline AND is_active))))),
  coalesce(lead.is_duplicate, false), dest_pipeline, dest_id, coalesce(dest_legacy, 'abordados'), agent, r.id)
 RETURNING id INTO new_id;
 INSERT INTO public.crm_lead_stage_history(lead_id, pipeline_id, stage_id, from_column, to_column, moved_by, note)
 VALUES (new_id, dest_pipeline, dest_id, NULL, dest_legacy, NULL, 'Distribuído pela roleta: ' || r.name);
 UPDATE public.crm_lead_roulettes SET cursor_position = (pos + 1) % total WHERE id = r.id;
 UPDATE public.crm_lead_distribution SET status = 'distributed', lead_id = new_id, pipeline_id = dest_pipeline,
  assigned_to = agent, distributed_at = now() WHERE id = receipt.id;
 IF p_source = 'genesy' THEN UPDATE public.form_submissions SET lead_id = new_id WHERE id::text = p_event AND user_id = p_owner; END IF;
 RETURN jsonb_build_object('matched', true, 'status', 'distributed', 'lead_id', new_id, 'pipeline_id', dest_pipeline, 'stage_id', dest_id);
END $$;

REVOKE ALL ON FUNCTION public.crm_save_roulette_group(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_save_roulette_group(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.crm_delete_roulette_group(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_delete_roulette_group(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.crm_save_roulette_queue(uuid, uuid, text, boolean, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_save_roulette_queue(uuid, uuid, text, boolean, jsonb, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.crm_roulette_set_form(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_roulette_set_form(uuid, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.crm_set_roulette_state(uuid, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_set_roulette_state(uuid, boolean, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.crm_distribute_form_lead(uuid, text, text, text, text, jsonb) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_distribute_form_lead(uuid, text, text, text, text, jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
