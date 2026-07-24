-- Pipeline exclusiva por colaborador.
-- Administradores, sócios e o dono da conta continuam com acesso integral.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS crm_pipeline_id uuid
  REFERENCES public.crm_pipelines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS user_profiles_crm_pipeline_id_idx
  ON public.user_profiles (crm_pipeline_id);

CREATE OR REPLACE FUNCTION public.current_member_has_full_crm_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    auth.uid() = public.effective_owner_id()
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles me
      WHERE me.auth_user_id = auth.uid()
        AND (
          me.role = 'admin'
          OR lower(translate(coalesce(me.job_title, ''), 'óôõöòÓÔÕÖÒ', 'oooooOOOOO')) = 'socio'
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_crm_pipeline(p_pipeline_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    public.current_member_has_full_crm_access()
    OR p_pipeline_id = (
      SELECT me.crm_pipeline_id
      FROM public.user_profiles me
      WHERE me.auth_user_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.current_member_has_full_crm_access() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_crm_pipeline(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_member_has_full_crm_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_crm_pipeline(uuid) TO authenticated;

-- Administradores e sócios convidados também podem gerenciar a equipe do
-- mesmo workspace. A proteção de autoedição abaixo continua impedindo que um
-- colaborador comum altere a própria pipeline/perfil/permissões.
DROP POLICY IF EXISTS "user_profiles_admin_insert_team" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_admin_update_team" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_admin_delete_team" ON public.user_profiles;
CREATE POLICY "user_profiles_admin_insert_team" ON public.user_profiles FOR INSERT WITH CHECK (
  public.current_member_has_full_crm_access()
  AND owner_id = public.effective_owner_id()
);
CREATE POLICY "user_profiles_admin_update_team" ON public.user_profiles FOR UPDATE USING (
  public.current_member_has_full_crm_access()
  AND owner_id = public.effective_owner_id()
) WITH CHECK (
  public.current_member_has_full_crm_access()
  AND owner_id = public.effective_owner_id()
);
CREATE POLICY "user_profiles_admin_delete_team" ON public.user_profiles FOR DELETE USING (
  public.current_member_has_full_crm_access()
  AND owner_id = public.effective_owner_id()
);

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT public.current_member_has_full_crm_access() THEN
    NEW.role            := OLD.role;
    NEW.permissions     := OLD.permissions;
    NEW.is_active       := OLD.is_active;
    NEW.owner_id        := OLD.owner_id;
    NEW.crm_pipeline_id := OLD.crm_pipeline_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "user_invites_admin_select_team" ON public.user_invites;
DROP POLICY IF EXISTS "user_invites_admin_insert_team" ON public.user_invites;
DROP POLICY IF EXISTS "user_invites_admin_update_team" ON public.user_invites;
DROP POLICY IF EXISTS "user_invites_admin_delete_team" ON public.user_invites;
CREATE POLICY "user_invites_admin_select_team" ON public.user_invites FOR SELECT USING (
  public.current_member_has_full_crm_access()
  AND owner_id = public.effective_owner_id()
);
CREATE POLICY "user_invites_admin_insert_team" ON public.user_invites FOR INSERT WITH CHECK (
  public.current_member_has_full_crm_access()
  AND owner_id = public.effective_owner_id()
  AND invited_by = auth.uid()
);
CREATE POLICY "user_invites_admin_update_team" ON public.user_invites FOR UPDATE USING (
  public.current_member_has_full_crm_access()
  AND owner_id = public.effective_owner_id()
);
CREATE POLICY "user_invites_admin_delete_team" ON public.user_invites FOR DELETE USING (
  public.current_member_has_full_crm_access()
  AND owner_id = public.effective_owner_id()
);

DROP POLICY IF EXISTS "crm_pipelines_select" ON public.crm_pipelines;
CREATE POLICY "crm_pipelines_select" ON public.crm_pipelines FOR SELECT USING (
  public.effective_owner_id() = user_id
  AND public.can_access_crm_pipeline(id)
);

DROP POLICY IF EXISTS "crm_pipelines_insert" ON public.crm_pipelines;
DROP POLICY IF EXISTS "crm_pipelines_update" ON public.crm_pipelines;
DROP POLICY IF EXISTS "crm_pipelines_delete" ON public.crm_pipelines;
CREATE POLICY "crm_pipelines_insert" ON public.crm_pipelines FOR INSERT WITH CHECK (
  public.effective_owner_id() = user_id AND public.current_member_has_full_crm_access()
);
CREATE POLICY "crm_pipelines_update" ON public.crm_pipelines FOR UPDATE USING (
  public.effective_owner_id() = user_id AND public.current_member_has_full_crm_access()
);
CREATE POLICY "crm_pipelines_delete" ON public.crm_pipelines FOR DELETE USING (
  public.effective_owner_id() = user_id AND public.current_member_has_full_crm_access()
);

DROP POLICY IF EXISTS "crm_stages_select" ON public.crm_stages;
CREATE POLICY "crm_stages_select" ON public.crm_stages FOR SELECT USING (
  public.effective_owner_id() = user_id
  AND public.can_access_crm_pipeline(pipeline_id)
);

DROP POLICY IF EXISTS "crm_stages_insert" ON public.crm_stages;
DROP POLICY IF EXISTS "crm_stages_update" ON public.crm_stages;
DROP POLICY IF EXISTS "crm_stages_delete" ON public.crm_stages;
CREATE POLICY "crm_stages_insert" ON public.crm_stages FOR INSERT WITH CHECK (
  public.effective_owner_id() = user_id AND public.current_member_has_full_crm_access()
);
CREATE POLICY "crm_stages_update" ON public.crm_stages FOR UPDATE USING (
  public.effective_owner_id() = user_id AND public.current_member_has_full_crm_access()
);
CREATE POLICY "crm_stages_delete" ON public.crm_stages FOR DELETE USING (
  public.effective_owner_id() = user_id AND public.current_member_has_full_crm_access()
);

DROP POLICY IF EXISTS "crm_stage_conversions_select" ON public.crm_stage_conversions;
CREATE POLICY "crm_stage_conversions_select" ON public.crm_stage_conversions FOR SELECT USING (
  public.effective_owner_id() = user_id
  AND EXISTS (
    SELECT 1 FROM public.crm_stages stage
    WHERE stage.id = crm_stage_conversions.stage_id
      AND public.can_access_crm_pipeline(stage.pipeline_id)
  )
);

DROP POLICY IF EXISTS "leads_select" ON public.leads;
DROP POLICY IF EXISTS "leads_insert" ON public.leads;
DROP POLICY IF EXISTS "leads_update" ON public.leads;
DROP POLICY IF EXISTS "leads_delete" ON public.leads;

CREATE POLICY "leads_select" ON public.leads FOR SELECT USING (
  public.effective_owner_id() = user_id
  AND public.can_view_lead(assigned_to)
  AND public.can_access_crm_pipeline(pipeline_id)
);
CREATE POLICY "leads_insert" ON public.leads FOR INSERT WITH CHECK (
  public.effective_owner_id() = user_id
  AND public.can_access_crm_pipeline(pipeline_id)
);
CREATE POLICY "leads_update" ON public.leads FOR UPDATE USING (
  public.effective_owner_id() = user_id
  AND public.can_view_lead(assigned_to)
  AND public.can_access_crm_pipeline(pipeline_id)
) WITH CHECK (
  public.effective_owner_id() = user_id
  AND public.can_access_crm_pipeline(pipeline_id)
);
CREATE POLICY "leads_delete" ON public.leads FOR DELETE USING (
  public.effective_owner_id() = user_id
  AND public.can_view_lead(assigned_to)
  AND public.can_access_crm_pipeline(pipeline_id)
);

DROP POLICY IF EXISTS "crm_lead_stage_history_select" ON public.crm_lead_stage_history;
CREATE POLICY "crm_lead_stage_history_select" ON public.crm_lead_stage_history FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.leads lead
    WHERE lead.id = crm_lead_stage_history.lead_id
      AND lead.user_id = public.effective_owner_id()
      AND public.can_access_crm_pipeline(lead.pipeline_id)
  )
);
