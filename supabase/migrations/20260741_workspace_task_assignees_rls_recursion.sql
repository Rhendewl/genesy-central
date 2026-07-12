-- ═══════════════════════════════════════════════════════════════════════════════
-- Workspace — corrige recursão RLS em responsáveis de tarefas
--
-- A policy de workspace_task_assignees_insert consultava workspace_tasks, e as
-- policies de workspace_tasks consultavam workspace_task_assignees. Em alguns
-- fluxos, principalmente criação com responsáveis e espelhos do onboarding, o
-- Postgres detectava recursão infinita ao avaliar as duas relações.
--
-- A correção move as checagens cruzadas para funções SECURITY DEFINER, que
-- executam a leitura auxiliar sem reentrar nas policies da tabela consultada.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.current_user_profile_is(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = p_profile_id
      AND up.auth_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_workspace_task_assignee(p_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_task_assignees wta
    JOIN public.user_profiles up ON up.id = wta.assignee_id
    WHERE wta.task_id = p_task_id
      AND up.auth_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_link_workspace_task_assignee_from_onboarding(p_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_tasks wt
    JOIN public.onboarding_tasks ot ON ot.id = wt.onboarding_task_id
    WHERE wt.id = p_task_id
      AND public.can_access_onboarding_project(ot.project_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_workspace_task(p_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_tasks wt
    WHERE wt.id = p_task_id
      AND (
        wt.user_id = auth.uid()
        OR public.is_admin_of_user(wt.user_id)
        OR public.current_user_is_workspace_task_assignee(wt.id)
      )
  );
$$;

DROP POLICY IF EXISTS "workspace_tasks_select" ON public.workspace_tasks;
DROP POLICY IF EXISTS "workspace_tasks_insert" ON public.workspace_tasks;
DROP POLICY IF EXISTS "workspace_tasks_update" ON public.workspace_tasks;
DROP POLICY IF EXISTS "workspace_tasks_delete" ON public.workspace_tasks;

CREATE POLICY "workspace_tasks_select" ON public.workspace_tasks FOR SELECT USING (
  auth.uid() = user_id
  OR public.is_admin_of_user(user_id)
  OR public.current_user_is_workspace_task_assignee(id)
);

CREATE POLICY "workspace_tasks_insert" ON public.workspace_tasks FOR INSERT WITH CHECK (
  auth.uid() = user_id
  OR public.is_admin_of_user(user_id)
  OR (
    onboarding_task_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.onboarding_tasks ot
      WHERE ot.id = onboarding_task_id
        AND public.can_access_onboarding_project(ot.project_id)
    )
  )
);

CREATE POLICY "workspace_tasks_update" ON public.workspace_tasks FOR UPDATE USING (
  auth.uid() = user_id
  OR public.is_admin_of_user(user_id)
  OR public.current_user_is_workspace_task_assignee(id)
);

CREATE POLICY "workspace_tasks_delete" ON public.workspace_tasks FOR DELETE USING (
  auth.uid() = user_id
  OR public.is_admin_of_user(user_id)
);

DROP POLICY IF EXISTS "workspace_task_assignees_select" ON public.workspace_task_assignees;
DROP POLICY IF EXISTS "workspace_task_assignees_insert" ON public.workspace_task_assignees;
DROP POLICY IF EXISTS "workspace_task_assignees_update" ON public.workspace_task_assignees;
DROP POLICY IF EXISTS "workspace_task_assignees_delete" ON public.workspace_task_assignees;

CREATE POLICY "workspace_task_assignees_select" ON public.workspace_task_assignees FOR SELECT USING (
  auth.uid() = user_id
  OR public.is_admin_of_user(user_id)
  OR public.current_user_profile_is(assignee_id)
);

CREATE POLICY "workspace_task_assignees_insert" ON public.workspace_task_assignees FOR INSERT WITH CHECK (
  auth.uid() = user_id
  OR public.is_admin_of_user(user_id)
  OR public.can_link_workspace_task_assignee_from_onboarding(task_id)
);

CREATE POLICY "workspace_task_assignees_update" ON public.workspace_task_assignees FOR UPDATE USING (
  auth.uid() = user_id
  OR public.is_admin_of_user(user_id)
);

CREATE POLICY "workspace_task_assignees_delete" ON public.workspace_task_assignees FOR DELETE USING (
  auth.uid() = user_id
  OR public.is_admin_of_user(user_id)
);
