-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: Conversas — agendamento do executor de fluxos via pg_cron
--
-- TEMPLATE: substitua URL e segredo antes de rodar em produção. Não commitar o
-- valor real do segredo de volta neste arquivo.
--
-- Observação Supabase: habilite pg_cron e pg_net pelo painel/SQL editor antes
-- desta migração. Este arquivo não cria as extensões para evitar conflito com
-- o script interno de privilégios do Supabase em projetos onde pg_cron já foi
-- provisionado.
--
-- Para inspecionar execuções:
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
--
-- Para cancelar/recriar:
--   SELECT cron.unschedule('conversation-flow-jobs-tick');
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
    PERFORM cron.unschedule('conversation-flow-jobs-tick');
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  PERFORM cron.schedule(
    'conversation-flow-jobs-tick',
    '* * * * *',
    $cron$
    SELECT net.http_post(
      url     := 'https://SEU_DOMINIO_AQUI/api/cron/conversation-flow-jobs',
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
