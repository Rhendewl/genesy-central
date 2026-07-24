-- Workspace / Tarefas — somente o criador pode alterar uma tarefa.
--
-- Responsáveis continuam podendo visualizar a tarefa e todos os seus detalhes,
-- mas não podem editar campos, mover status, alterar checklist, comentar,
-- adicionar/remover anexos, trocar responsáveis ou excluir o registro.

CREATE OR REPLACE FUNCTION public.can_edit_workspace_task(p_task_id uuid)
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
      AND wt.created_by = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.can_edit_workspace_task(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_edit_workspace_task(uuid) TO authenticated;

-- Tarefa principal: preserva as regras atuais de leitura e restringe mutações.
DROP POLICY IF EXISTS "workspace_tasks_insert" ON public.workspace_tasks;
DROP POLICY IF EXISTS "workspace_tasks_update" ON public.workspace_tasks;
DROP POLICY IF EXISTS "workspace_tasks_delete" ON public.workspace_tasks;

CREATE POLICY "workspace_tasks_insert"
ON public.workspace_tasks
FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND (auth.uid() = user_id OR public.is_admin_of_user(user_id))
);

CREATE POLICY "workspace_tasks_update"
ON public.workspace_tasks
FOR UPDATE
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "workspace_tasks_delete"
ON public.workspace_tasks
FOR DELETE
USING (created_by = auth.uid());

-- Responsáveis: só o criador da tarefa pode trocar a atribuição.
DROP POLICY IF EXISTS "workspace_task_assignees_insert" ON public.workspace_task_assignees;
DROP POLICY IF EXISTS "workspace_task_assignees_update" ON public.workspace_task_assignees;
DROP POLICY IF EXISTS "workspace_task_assignees_delete" ON public.workspace_task_assignees;

CREATE POLICY "workspace_task_assignees_insert"
ON public.workspace_task_assignees
FOR INSERT
WITH CHECK (public.can_edit_workspace_task(task_id));

CREATE POLICY "workspace_task_assignees_update"
ON public.workspace_task_assignees
FOR UPDATE
USING (public.can_edit_workspace_task(task_id))
WITH CHECK (public.can_edit_workspace_task(task_id));

CREATE POLICY "workspace_task_assignees_delete"
ON public.workspace_task_assignees
FOR DELETE
USING (public.can_edit_workspace_task(task_id));

-- Recursos internos: leitura segue compartilhada; toda escrita exige autoria.
DO $$
DECLARE
  tbl text;
  tbls text[] := ARRAY[
    'workspace_task_checklist_items',
    'workspace_task_comments',
    'workspace_task_attachments'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_insert', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_update', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_delete', tbl);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (public.can_edit_workspace_task(task_id))',
      tbl || '_insert', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE USING (public.can_edit_workspace_task(task_id)) WITH CHECK (public.can_edit_workspace_task(task_id))',
      tbl || '_update', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE USING (public.can_edit_workspace_task(task_id))',
      tbl || '_delete', tbl
    );
  END LOOP;
END;
$$;
