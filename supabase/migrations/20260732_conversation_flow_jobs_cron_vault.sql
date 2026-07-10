-- ═══════════════════════════════════════════════════════════════════════════════
-- Conversas — reagenda o executor de fluxos lendo o segredo do cron via
-- Supabase Vault, em vez de texto plano na migration.
--
-- A migration anterior (20260708_conversation_flow_jobs_cron.sql) tem, na
-- working tree local, uma edição não commitada com o segredo real em texto
-- plano no HTTP POST (a versão commitada no git tem só placeholders —
-- confirmado via `git show HEAD:...`, o segredo nunca chegou a ir pro
-- histórico do repositório). Ainda assim, essa edição local não deveria ser
-- commitada assim, e não deve ficar como referência permanente da forma como
-- o cron é configurado. Esta migration substitui aquele agendamento por um
-- que lê o valor do Vault, e é segura de commitar/rodar em qualquer ambiente
-- (zero segredo no arquivo). A migration antiga foi deixada intocada (não se
-- edita migration histórica).
--
-- Passos manuais necessários (fora desta migration, nunca em SQL commitado):
--   1. Gerar um novo segredo, ex.: `openssl rand -base64 32`.
--   2. No SQL Editor do Supabase (não em arquivo versionado):
--        select vault.create_secret('<NOVO_SEGREDO>', 'conversation_flow_cron_secret');
--   3. Aplicar esta migration.
--   4. Atualizar CRON_SECRET na Vercel (Production/Preview) com o MESMO valor
--      do passo 2, e fazer redeploy.
--   5. Validar: select * from cron.job_run_details
--                where jobid = (select jobid from cron.job where jobname = 'conversation-flow-jobs-tick')
--                order by start_time desc limit 5;
--      (esperado: status_code 200 nas execuções após a troca)
--
-- Enquanto o passo 1-4 não for feito, o job continua rodando com o segredo
-- antigo (agora lido do Vault só depois que o secret existir lá) — sem
-- quebrar o cron durante a transição, desde que o secret seja criado com o
-- MESMO valor que já está configurado como CRON_SECRET na Vercel, e só depois
-- trocado.
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
      url     := 'https://genesycompany.com/api/cron/conversation-flow-jobs',
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'X-Cron-Secret', (
                     SELECT decrypted_secret
                     FROM vault.decrypted_secrets
                     WHERE name = 'conversation_flow_cron_secret'
                     LIMIT 1
                   )
                 ),
      body    := '{}'::jsonb,
      timeout_milliseconds := 25000
    );
    $cron$
  );
END $$;
