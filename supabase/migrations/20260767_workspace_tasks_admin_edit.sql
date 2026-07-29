-- Workspace / Tarefas — criador ou administrador pode editar e descartar.
--
-- Membros comuns continuam limitados às tarefas que criaram. Administradores
-- ativos da mesma organização recebem acesso integral aos campos da tarefa,
-- responsáveis, checklist, comentários e anexos.

CREATE OR REPLACE FUNCTION public.can_edit_workspace_task(p_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_tasks wt
    WHERE wt.id = p_task_id
      AND (
        wt.created_by = auth.uid()
        OR public.is_admin_of_user(wt.user_id)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_edit_workspace_task(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_edit_workspace_task(uuid) TO authenticated;

-- Autoria e workspace são identidade da tarefa e não podem ser trocados por
-- um PATCH direto ao PostgREST. As APIs já trabalham com whitelist, e este
-- trigger mantém a mesma garantia no banco.
CREATE OR REPLACE FUNCTION public.protect_workspace_task_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'A autoria e o workspace da tarefa são imutáveis';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_workspace_task_identity ON public.workspace_tasks;
CREATE TRIGGER trg_protect_workspace_task_identity
BEFORE UPDATE OF created_by, user_id ON public.workspace_tasks
FOR EACH ROW EXECUTE FUNCTION public.protect_workspace_task_identity();

DROP POLICY IF EXISTS "workspace_tasks_update" ON public.workspace_tasks;
DROP POLICY IF EXISTS "workspace_tasks_delete" ON public.workspace_tasks;

CREATE POLICY "workspace_tasks_update"
ON public.workspace_tasks
FOR UPDATE
USING (public.can_edit_workspace_task(id))
WITH CHECK (public.can_edit_workspace_task(id));

CREATE POLICY "workspace_tasks_delete"
ON public.workspace_tasks
FOR DELETE
USING (public.can_edit_workspace_task(id));

-- As políticas de workspace_task_assignees, checklist, comentários e anexos
-- já chamam can_edit_workspace_task(task_id). Ao atualizar a função acima,
-- elas passam a reconhecer administradores sem duplicar a regra.

COMMENT ON FUNCTION public.can_edit_workspace_task(uuid) IS
  'Permite mutações da tarefa ao criador ou a um administrador ativo da mesma organização.';
