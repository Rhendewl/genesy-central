-- Mantém automações com atraso em execução. Reutiliza o mesmo CRON_SECRET já
-- armazenado no Vault para os webhooks e demais workers internos.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION 'Extensão pg_cron não habilitada.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION 'Extensão pg_net não habilitada.';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'webhook_delivery_cron_secret'
      AND decrypted_secret IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Segredo webhook_delivery_cron_secret não encontrado no Vault.';
  END IF;

  BEGIN
    PERFORM cron.unschedule('workflow-jobs-tick');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  PERFORM cron.schedule(
    'workflow-jobs-tick',
    '* * * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://dash.genesycompany.com/api/cron/workflow-jobs',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'webhook_delivery_cron_secret'
          LIMIT 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 25000
    );
    $cron$
  );
END $$;
