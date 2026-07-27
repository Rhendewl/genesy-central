-- A pipeline atribuída ao colaborador é o limite de acesso do CRM.
--
-- A regra anterior, criada antes do acesso exclusivo por pipeline, ainda
-- restringia SDRs aos cards cujo assigned_to apontava para o próprio perfil.
-- As duas regras juntas faziam um SDR enxergar a pipeline e as etapas, mas não
-- os leads já presentes nela. can_access_crm_pipeline continua garantindo que
-- o colaborador não veja dados de outras pipelines.

CREATE OR REPLACE FUNCTION public.can_access_crm_pipeline(p_pipeline_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    public.current_member_has_full_crm_access()
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles me
      WHERE me.auth_user_id = auth.uid()
        AND me.is_active
        AND me.crm_pipeline_id = p_pipeline_id
    );
$$;

CREATE OR REPLACE FUNCTION public.can_view_lead(p_assigned_to uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    public.current_member_has_full_crm_access()
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles me
      WHERE me.auth_user_id = auth.uid()
        AND me.is_active
        AND (
          -- Com pipeline atribuída, a policy de leads já limita a leitura à
          -- pipeline do perfil; assigned_to é responsabilidade, não permissão.
          me.crm_pipeline_id IS NOT NULL
          OR me.role <> 'comercial'
          OR me.id = p_assigned_to
        )
    );
$$;

REVOKE ALL ON FUNCTION public.can_access_crm_pipeline(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_lead(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_crm_pipeline(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_lead(uuid) TO authenticated;

COMMENT ON FUNCTION public.can_access_crm_pipeline(uuid) IS
  'Autoriza administradores ou o membro ativo explicitamente vinculado à pipeline.';
COMMENT ON FUNCTION public.can_view_lead(uuid) IS
  'Compatibilidade com policies e RPCs legadas; membros com pipeline veem todos os cards da pipeline autorizada.';
