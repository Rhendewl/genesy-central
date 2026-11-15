-- Hourly collection uses the existing Supabase scheduler, compatible with Vercel Hobby.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_net')
     OR NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name='webhook_delivery_cron_secret') THEN
    RAISE EXCEPTION 'Existing Instagram scheduler prerequisites are missing';
  END IF;
  PERFORM cron.schedule('instagram-competitors-tick','30 * * * *',$cron$
    SELECT net.http_post(
      url := 'https://dash.genesycompany.com/api/cron/instagram-competitors',
      headers := jsonb_build_object('Content-Type','application/json','X-Cron-Secret',
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='webhook_delivery_cron_secret' LIMIT 1)),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $cron$);
END $$;
