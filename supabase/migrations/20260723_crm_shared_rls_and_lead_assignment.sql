-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: CRM/Leads — RLS compartilhada em pipelines/stages, responsável
-- estruturado em leads, visibilidade por papel (Fase 3)
--
-- Bug corrigido: crm_pipelines/crm_stages/crm_stage_conversions estavam em
-- RLS pessoal (auth.uid() = user_id) enquanto leads já é compartilhado
-- (effective_owner_id()). Um convidado (uid próprio ≠ uid do dono) nunca via
-- pipeline/stage nenhum e não conseguia mover lead no Kanban.
--
-- Recurso novo: leads.assigned_to (responsável estruturado) + regra de
-- visibilidade — SDR (role='comercial') só vê leads atribuídos a ele mesmo;
-- qualquer outro papel com acesso ao CRM continua vendo tudo.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. crm_pipelines / crm_stages / crm_stage_conversions → padrão compartilhado ──

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY['crm_pipelines', 'crm_stages', 'crm_stage_conversions'];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    -- Remove a policy única "_owner" (USING/WITH CHECK auth.uid() = user_id)
    -- criada em 20260629_crm_pipelines.sql, antes de aplicar o padrão de 4
    -- policies do apply_standard_rls.
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_owner', tbl);

    EXECUTE format('DROP TRIGGER IF EXISTS trg_auto_owner_%I ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_auto_owner_%I
       BEFORE INSERT ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.auto_set_owner_id()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

SELECT public.apply_standard_rls('crm_pipelines');
SELECT public.apply_standard_rls('crm_stages');
SELECT public.apply_standard_rls('crm_stage_conversions');

-- ── 2. crm_lead_stage_history — sem user_id próprio, via join com leads ──────

ALTER TABLE public.crm_lead_stage_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_lead_stage_history_owner" ON public.crm_lead_stage_history;
DROP POLICY IF EXISTS "crm_lead_stage_history_select" ON public.crm_lead_stage_history;
DROP POLICY IF EXISTS "crm_lead_stage_history_insert" ON public.crm_lead_stage_history;

CREATE POLICY "crm_lead_stage_history_select" ON public.crm_lead_stage_history FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.leads WHERE leads.id = crm_lead_stage_history.lead_id AND leads.user_id = public.effective_owner_id())
);
CREATE POLICY "crm_lead_stage_history_insert" ON public.crm_lead_stage_history FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.leads WHERE leads.id = crm_lead_stage_history.lead_id AND leads.user_id = public.effective_owner_id())
);

-- ── 3. leads.assigned_to ──────────────────────────────────────────────────────

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS leads_assigned_to_idx ON public.leads (assigned_to);

-- ── 4. Visibilidade por papel — SDR só vê os próprios leads atribuídos ───────

CREATE OR REPLACE FUNCTION public.can_view_lead(p_assigned_to uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    NOT EXISTS (
      SELECT 1 FROM public.user_profiles me
      WHERE me.auth_user_id = auth.uid() AND me.role = 'comercial'
    )
    OR p_assigned_to = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid());
$$;

DROP POLICY IF EXISTS "leads_select" ON public.leads;
DROP POLICY IF EXISTS "leads_insert" ON public.leads;
DROP POLICY IF EXISTS "leads_update" ON public.leads;
DROP POLICY IF EXISTS "leads_delete" ON public.leads;

CREATE POLICY "leads_select" ON public.leads FOR SELECT USING (
  public.effective_owner_id() = user_id AND public.can_view_lead(assigned_to)
);
CREATE POLICY "leads_insert" ON public.leads FOR INSERT WITH CHECK (
  public.effective_owner_id() = user_id
);
CREATE POLICY "leads_update" ON public.leads FOR UPDATE USING (
  public.effective_owner_id() = user_id AND public.can_view_lead(assigned_to)
);
CREATE POLICY "leads_delete" ON public.leads FOR DELETE USING (
  public.effective_owner_id() = user_id AND public.can_view_lead(assigned_to)
);

-- ── 5. crm_move_lead — usa effective_owner_id() em vez de um p_user_id vindo do client ──
--
-- Antes: comparava leads.user_id/crm_stages.user_id contra p_user_id = uid
-- bruto de quem chamou — nunca batia pra um convidado. Agora resolve o dono
-- efetivo internamente, igual a RLS já faz em todo o resto do schema.

DROP FUNCTION IF EXISTS public.crm_move_lead(uuid, uuid, uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.crm_move_lead(
  p_lead_id  uuid,
  p_stage_id uuid,
  p_note     text DEFAULT NULL,
  p_moved_by uuid DEFAULT NULL
)
RETURNS TABLE (
  lead_id       uuid,
  pipeline_id   uuid,
  stage_id      uuid,
  from_stage_id uuid,
  from_column   text,
  to_column     text
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_from_stage_id uuid;
  v_from_column   text;
  v_pipeline_id   uuid;
  v_legacy_column text;
  v_owner_id      uuid := public.effective_owner_id();
BEGIN
  SELECT l.stage_id, l.kanban_column
    INTO v_from_stage_id, v_from_column
  FROM leads l
  WHERE l.id = p_lead_id AND l.user_id = v_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEAD_NOT_FOUND';
  END IF;

  SELECT s.pipeline_id, s.legacy_column
    INTO v_pipeline_id, v_legacy_column
  FROM crm_stages s
  WHERE s.id      = p_stage_id
    AND s.user_id = v_owner_id
    AND s.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STAGE_NOT_FOUND';
  END IF;

  UPDATE leads
  SET
    pipeline_id   = v_pipeline_id,
    stage_id      = p_stage_id,
    kanban_column = COALESCE(v_legacy_column, kanban_column),
    updated_at    = now()
  WHERE id = p_lead_id;

  INSERT INTO crm_lead_stage_history (
    lead_id, pipeline_id, stage_id, from_column, to_column, moved_by, note
  )
  VALUES (
    p_lead_id, v_pipeline_id, p_stage_id, v_from_column, v_legacy_column, p_moved_by, p_note
  );

  IF v_from_column IS NOT NULL
    AND v_legacy_column IS NOT NULL
    AND v_from_column <> v_legacy_column
  THEN
    INSERT INTO lead_movements (lead_id, from_column, to_column)
    VALUES (p_lead_id, v_from_column, v_legacy_column);
  END IF;

  RETURN QUERY
  SELECT p_lead_id, v_pipeline_id, p_stage_id, v_from_stage_id, v_from_column, v_legacy_column;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_move_lead(uuid, uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_move_lead(uuid, uuid, text, uuid) TO authenticated;
