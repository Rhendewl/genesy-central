-- Existing values stay NULL until the user re-syncs the requested period.
ALTER TABLE public.campaign_metrics ADD COLUMN IF NOT EXISTS messaging_results jsonb;
COMMENT ON COLUMN public.campaign_metrics.messaging_results IS 'Meta conversations started: total, whatsapp, direct, messenger, unclassified. NULL means historical data not re-synced. No channel is inferred from campaign names or placements.';
NOTIFY pgrst, 'reload schema';
