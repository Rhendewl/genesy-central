-- Instagram flows, round 2: contact profile + collected answers, faster worker.

-- Name from Instagram's User Profile API ({primeiro_nome}) and answers
-- collected by "Aguardar resposta" blocks (WhatsApp, e-mail, custom fields).
ALTER TABLE public.marketing_instagram_contacts
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS profile_fetched_at timestamptz,
  ADD COLUMN IF NOT EXISTS fields jsonb NOT NULL DEFAULT '{}'::jsonb;

-- The worker now runs every 10 seconds (flows started by a webhook already run
-- immediately; this covers delays longer than a minute and reply timeouts).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net')
     AND EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'webhook_delivery_cron_secret') THEN
    BEGIN PERFORM cron.unschedule('instagram-automations-tick'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'instagram-automations-tick', '10 seconds',
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
