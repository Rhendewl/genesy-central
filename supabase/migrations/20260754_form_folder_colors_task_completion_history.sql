-- Formulários: cores das pastas.
-- Performance: histórico imutável de tarefas concluídas, preservado após exclusão.

ALTER TABLE public.form_folders
  ADD COLUMN IF NOT EXISTS color text DEFAULT '#4a8fd4';

CREATE TABLE IF NOT EXISTS public.workspace_task_completion_history (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id             uuid NOT NULL,
  owner_user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignee_id         uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  completed_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  task_title          text NOT NULL,
  due_date            date,
  completed_at        timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, assignee_id)
);

CREATE INDEX IF NOT EXISTS workspace_task_completion_history_owner_date_idx
  ON public.workspace_task_completion_history (owner_user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS workspace_task_completion_history_assignee_date_idx
  ON public.workspace_task_completion_history (assignee_id, completed_at DESC);

ALTER TABLE public.workspace_task_completion_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_task_completion_history_select" ON public.workspace_task_completion_history;
CREATE POLICY "workspace_task_completion_history_select"
ON public.workspace_task_completion_history
FOR SELECT
USING (
  owner_user_id = auth.uid()
  OR public.is_admin_of_user(owner_user_id)
  OR EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = workspace_task_completion_history.assignee_id
      AND up.auth_user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.record_workspace_task_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'concluido' AND OLD.status IS DISTINCT FROM 'concluido' THEN
    INSERT INTO public.workspace_task_completion_history (
      task_id, owner_user_id, assignee_id, completed_by, task_title, due_date, completed_at
    )
    SELECT
      NEW.id,
      NEW.user_id,
      wta.assignee_id,
      auth.uid(),
      NEW.title,
      NEW.due_date,
      COALESCE(NEW.completed_at, now())
    FROM public.workspace_task_assignees wta
    WHERE wta.task_id = NEW.id
    ON CONFLICT (task_id, assignee_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_workspace_task_completion ON public.workspace_tasks;
CREATE TRIGGER trg_record_workspace_task_completion
  AFTER UPDATE OF status ON public.workspace_tasks
  FOR EACH ROW EXECUTE FUNCTION public.record_workspace_task_completion();

CREATE OR REPLACE FUNCTION public.record_completed_task_new_assignee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.workspace_task_completion_history (
    task_id, owner_user_id, assignee_id, completed_by, task_title, due_date, completed_at
  )
  SELECT
    wt.id,
    wt.user_id,
    NEW.assignee_id,
    auth.uid(),
    wt.title,
    wt.due_date,
    COALESCE(wt.completed_at, now())
  FROM public.workspace_tasks wt
  WHERE wt.id = NEW.task_id
    AND wt.status = 'concluido'
  ON CONFLICT (task_id, assignee_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_completed_task_new_assignee ON public.workspace_task_assignees;
CREATE TRIGGER trg_record_completed_task_new_assignee
  AFTER INSERT ON public.workspace_task_assignees
  FOR EACH ROW EXECUTE FUNCTION public.record_completed_task_new_assignee();

-- Backfill das tarefas concluídas que ainda existem hoje.
INSERT INTO public.workspace_task_completion_history (
  task_id, owner_user_id, assignee_id, task_title, due_date, completed_at
)
SELECT
  wt.id,
  wt.user_id,
  wta.assignee_id,
  wt.title,
  wt.due_date,
  COALESCE(wt.completed_at, wt.updated_at, wt.created_at)
FROM public.workspace_tasks wt
JOIN public.workspace_task_assignees wta ON wta.task_id = wt.id
WHERE wt.status = 'concluido'
ON CONFLICT (task_id, assignee_id) DO NOTHING;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_task_completion_history;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE public.workspace_task_completion_history IS
  'Registro histórico imutável usado pela performance; não é apagado com a tarefa.';
