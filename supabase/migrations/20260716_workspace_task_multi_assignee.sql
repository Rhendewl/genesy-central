-- ═══════════════════════════════════════════════════════════════════════════════
-- Workspace — Tarefas: múltiplos responsáveis
--
-- workspace_tasks.assignee_id era uma FK única (1 responsável por tarefa).
-- Substituído por uma tabela de vínculo N:N, mesmo padrão de ownership das
-- demais tabelas filhas de workspace_tasks (migration 20260712).
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.workspace_task_assignees (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id     uuid        NOT NULL REFERENCES public.workspace_tasks(id) ON DELETE CASCADE,
  assignee_id uuid        NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, assignee_id)
);

CREATE INDEX IF NOT EXISTS workspace_task_assignees_task_idx     ON public.workspace_task_assignees (task_id);
CREATE INDEX IF NOT EXISTS workspace_task_assignees_assignee_idx ON public.workspace_task_assignees (assignee_id);

DROP TRIGGER IF EXISTS trg_auto_owner_workspace_task_assignees ON public.workspace_task_assignees;
CREATE TRIGGER trg_auto_owner_workspace_task_assignees
  BEFORE INSERT ON public.workspace_task_assignees
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_owner_id();

SELECT public.apply_standard_rls('workspace_task_assignees');

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_task_assignees;
EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ── Backfill: assignee_id único existente vira 1 linha na tabela de vínculo ────

INSERT INTO public.workspace_task_assignees (user_id, task_id, assignee_id)
SELECT user_id, id, assignee_id
FROM public.workspace_tasks
WHERE assignee_id IS NOT NULL
ON CONFLICT (task_id, assignee_id) DO NOTHING;


-- ── Remove a coluna antiga — a tabela de vínculo passa a ser a única fonte ─────

DROP INDEX IF EXISTS workspace_tasks_assignee_idx;
ALTER TABLE public.workspace_tasks DROP COLUMN IF EXISTS assignee_id;
