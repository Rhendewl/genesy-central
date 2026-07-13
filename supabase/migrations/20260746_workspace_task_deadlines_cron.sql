-- ═══════════════════════════════════════════════════════════════════════════════
-- Workspace — agendamento dos lembretes de prazo via pg_cron
--
-- TEMPLATE: substitua URL e segredo antes de rodar em produção. Não commitar o
-- valor real do segredo de volta neste arquivo.
--
-- Usamos Supabase pg_cron/pg_net porque Vercel Hobby limita cron para execução
-- diária, enquanto lembretes de tarefas precisam de checagens mais frequentes.
--
-- Para inspecionar execuções:
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
--
-- Para cancelar/recriar:
--   SELECT cron.unschedule('workspace-task-deadlines-tick');
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION 'Extensão pg_cron não habilitada. Habilite pg_cron no Supabase antes de aplicar esta migração.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION 'Extensão pg_net não habilitada. Habilite pg_net no Supabase antes de aplicar esta migração.';
  END IF;

  BEGIN
    PERFORM cron.unschedule('workspace-task-deadlines-tick');
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  PERFORM cron.schedule(
    'workspace-task-deadlines-tick',
    '*/15 * * * *',
    $cron$
    SELECT net.http_post(
      url     := 'https://SEU_DOMINIO_AQUI/api/cron/workspace-task-deadlines',
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'X-Cron-Secret', 'SEU_CRON_SECRET_AQUI'
                 ),
      body    := '{}'::jsonb,
      timeout_milliseconds := 25000
    );
    $cron$
  );
END $$;
