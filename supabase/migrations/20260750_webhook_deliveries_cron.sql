-- Pré-requisito manual (uma vez por ambiente):
--   SELECT vault.create_secret('<MESMO_VALOR_DO_CRON_SECRET>', 'webhook_delivery_cron_secret');
-- A rota também pode ser acionada por outro scheduler com Bearer CRON_SECRET.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION 'Extensão pg_cron não habilitada.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION 'Extensão pg_net não habilitada.';
  END IF;

  BEGIN
    PERFORM cron.unschedule('webhook-deliveries-tick');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  PERFORM cron.schedule(
    'webhook-deliveries-tick',
    '* * * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://dash.genesycompany.com/api/cron/webhook-deliveries',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'webhook_delivery_cron_secret' LIMIT 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 25000
    );
    $cron$
  );
END $$;
