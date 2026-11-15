-- Supabase scheduler avoids the once-daily limit of the Vercel Hobby plan.
-- Reuse the same Vault secret used by the existing Instagram workers.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net')
     OR NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'webhook_delivery_cron_secret') THEN
    RAISE EXCEPTION 'Configure pg_cron, pg_net and webhook_delivery_cron_secret before activating Instagram scheduling';
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'instagram-scheduled-posts-tick') THEN
    PERFORM cron.unschedule('instagram-scheduled-posts-tick');
  END IF;
  PERFORM cron.schedule('instagram-scheduled-posts-tick', '* * * * *', $cron$
    SELECT net.http_post(
      url := 'https://dash.genesycompany.com/api/cron/instagram-posts',
      headers := jsonb_build_object('Content-Type', 'application/json', 'X-Cron-Secret',
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'webhook_delivery_cron_secret' LIMIT 1)),
      body := '{}'::jsonb,
      timeout_milliseconds := 300000
    );
  $cron$);
END $$;
