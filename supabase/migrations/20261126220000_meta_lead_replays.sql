-- Fila de reprocessamento agendado de leads da Meta (ex.: captura estava
-- desligada). O cron chama /api/cron/meta-lead-replays a cada 5 minutos e
-- processa os itens cujo run_at já passou, pelo mesmo fluxo do webhook.
CREATE TABLE IF NOT EXISTS public.meta_lead_replays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  page_id text NOT NULL,
  form_id text NOT NULL,
  leadgen_id text NOT NULL,
  run_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'error')),
  lead_id uuid,
  result jsonb,
  error text,
  attempts_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, leadgen_id)
);
CREATE INDEX IF NOT EXISTS meta_lead_replays_due_idx ON public.meta_lead_replays (run_at) WHERE status = 'pending';
ALTER TABLE public.meta_lead_replays ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meta_lead_replays FROM anon, authenticated;
GRANT ALL ON public.meta_lead_replays TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net')
     AND EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'webhook_delivery_cron_secret') THEN
    BEGIN PERFORM cron.unschedule('meta-lead-replays-tick'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'meta-lead-replays-tick', '*/5 * * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://dash.genesycompany.com/api/cron/meta-lead-replays',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'webhook_delivery_cron_secret' LIMIT 1)
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 55000
      );
      $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron, pg_net ou o segredo webhook_delivery_cron_secret não estão disponíveis: agende a rota manualmente.';
  END IF;
END $$;
