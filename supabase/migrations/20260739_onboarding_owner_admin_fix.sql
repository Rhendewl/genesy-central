-- ═══════════════════════════════════════════════════════════════════════════════
-- Workspace > Onboarding — corrige reconhecimento do dono como admin
--
-- O RLS de onboarding_projects usa public.is_admin_of_owner(user_id).
-- Em contas onde a linha self do dono em user_profiles ainda não existe ou foi
-- criada antes da simetria de perfil pessoal, o próprio owner pode falhar no
-- INSERT com "new row violates row-level security policy".
--
-- Colaboradores continuam bloqueados: para eles auth.uid() != target_owner_id.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_admin_of_owner(target_owner_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    auth.uid() = target_owner_id
    OR EXISTS (
      SELECT 1 FROM public.user_profiles me
      WHERE me.auth_user_id = auth.uid()
        AND me.role = 'admin'
        AND me.is_active
        AND me.owner_id = target_owner_id
    );
$$;
