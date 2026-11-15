-- Completed tasks are retained permanently. The application's hidden-history
-- column is derived from completed_at; only explicit discard deletes tasks.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') AND EXISTS(SELECT 1 FROM cron.job WHERE jobname='workspace-completed-task-cleanup') THEN
   PERFORM cron.unschedule('workspace-completed-task-cleanup');
 END IF;
END $$;
COMMENT ON INDEX public.workspace_tasks_completed_cleanup_idx IS 'Apoia consulta ao histórico de tarefas concluídas. Não há exclusão automática.';
