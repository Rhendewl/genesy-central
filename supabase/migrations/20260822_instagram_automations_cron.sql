-- Uses the same Vault secret as the existing internal workers. Environments
-- without pg_cron/pg_net remain valid and can call the route externally.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net')
     AND EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'webhook_delivery_cron_secret') THEN
    BEGIN PERFORM cron.unschedule('instagram-automations-tick'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'instagram-automations-tick', '* * * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://dash.genesycompany.com/api/cron/instagram-automations',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'webhook_delivery_cron_secret' LIMIT 1)
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 25000
      );
      $cron$
    );
  END IF;
END $$;
