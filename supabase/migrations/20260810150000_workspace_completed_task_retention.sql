-- Tarefas concluídas ficam no quadro por 24 horas e depois são descartadas.
-- O histórico de performance permanece em workspace_task_completion_history,
-- que não possui FK com cascade para workspace_tasks.

CREATE INDEX IF NOT EXISTS workspace_tasks_completed_cleanup_idx
  ON public.workspace_tasks (completed_at)
  WHERE status = 'concluido';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION 'Extensão pg_cron não habilitada.';
  END IF;

  BEGIN
    PERFORM cron.unschedule('workspace-completed-task-cleanup');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  PERFORM cron.schedule(
    'workspace-completed-task-cleanup',
    '*/15 * * * *',
    $cron$
      DELETE FROM public.workspace_tasks
      WHERE status = 'concluido'
        AND COALESCE(completed_at, updated_at, created_at) <= now() - interval '24 hours';
    $cron$
  );
END $$;

COMMENT ON INDEX public.workspace_tasks_completed_cleanup_idx IS
  'Apoia o descarte automático de tarefas concluídas após 24 horas.';
