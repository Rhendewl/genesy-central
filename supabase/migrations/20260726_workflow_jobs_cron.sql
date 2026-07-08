-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: Workflow Engine — agendamento via pg_cron
--
-- Este é um TEMPLATE, não uma migration idempotente comum: precisa da
-- substituição manual da URL e do segredo abaixo antes de rodar. Não
-- commitar o valor real do segredo de volta neste arquivo.
--
-- Depois de rodar, para inspecionar as execuções agendadas:
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
--
-- Para cancelar/recriar o schedule (ex: trocar o segredo ou a URL):
--   SELECT cron.unschedule('workflow-jobs-tick');
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Necessário para o schema "cron" (criado no schema próprio da extensão)
-- ficar acessível a partir do SQL Editor/roles padrão do Supabase.
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA cron TO postgres;

SELECT cron.schedule(
  'workflow-jobs-tick',
  '* * * * *',  -- a cada 1 minuto
  $$
  SELECT net.http_post(
    url     := 'https://SEU_DOMINIO_AQUI/api/cron/workflow-jobs',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'X-Cron-Secret', 'SEU_CRON_SECRET_AQUI'
               ),
    body    := '{}'::jsonb,
    -- padrão do pg_net é 5000ms — pouco pra processar um lote de jobs
    -- atrasados (várias consultas por job); 25s dá bastante margem.
    timeout_milliseconds := 25000
  );
  $$
);
