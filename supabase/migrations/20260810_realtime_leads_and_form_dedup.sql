-- Atualização imediata do CRM entre dispositivos/sessões e índice de apoio à
-- proteção contra replays idênticos de formulários.

ALTER TABLE public.leads REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS form_submissions_completed_dedup_idx
  ON public.form_submissions (form_id, completed_at DESC)
  WHERE status = 'completed';
