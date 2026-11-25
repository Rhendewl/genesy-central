-- Visual flows (nodes) for Instagram automations.
--
-- * automations.flow: graph edited in the node builder. NULL keeps the linear
--   "steps" editor format, converted to an equivalent flow when a run starts.
-- * runs keep a snapshot of the flow they started with, the block they are on
--   and whether they are waiting for the contact (reply or button tap).
-- * contacts carry Meta's messaging window (last Direct message, 7-day window
--   for Click-to-Direct ads), an opt-out flag and tags used by conditions.

ALTER TABLE public.marketing_instagram_automations
  ADD COLUMN IF NOT EXISTS flow jsonb;

COMMENT ON COLUMN public.marketing_instagram_automations.flow IS
  'Automation graph {version, nodes, edges} from the visual builder. NULL = legacy linear steps.';

ALTER TABLE public.marketing_instagram_contacts
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS ad_window_until timestamptz,
  ADD COLUMN IF NOT EXISTS opted_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

-- Last Direct interaction per contact (comments do not open the Direct window).
UPDATE public.marketing_instagram_contacts contact
SET last_message_at = latest.occurred_at
FROM (
  SELECT connection_id, sender_scoped_id, max(occurred_at) AS occurred_at
  FROM public.marketing_instagram_automation_events
  WHERE event_type <> 'comment' AND sender_scoped_id IS NOT NULL
  GROUP BY connection_id, sender_scoped_id
) latest
WHERE contact.connection_id = latest.connection_id
  AND contact.instagram_scoped_id = latest.sender_scoped_id
  AND contact.last_message_at IS NULL;

-- Opt-out used to be recomputed from every event on each job; keep it as a flag.
UPDATE public.marketing_instagram_contacts contact
SET opted_out_at = opted.occurred_at
FROM (
  SELECT connection_id, sender_scoped_id, max(occurred_at) AS occurred_at
  FROM public.marketing_instagram_automation_events
  WHERE sender_scoped_id IS NOT NULL
    AND btrim(regexp_replace(regexp_replace(
      translate(lower(coalesce(text, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
      '[^a-z0-9[:space:]]', '', 'g'), '[[:space:]]+', ' ', 'g'))
      IN ('parar', 'pare', 'sair', 'stop', 'cancelar', 'cancele', 'descadastrar', 'nao quero mais')
  GROUP BY connection_id, sender_scoped_id
) opted
WHERE contact.connection_id = opted.connection_id
  AND contact.instagram_scoped_id = opted.sender_scoped_id
  AND contact.opted_out_at IS NULL;

ALTER TABLE public.marketing_instagram_automation_runs
  ADD COLUMN IF NOT EXISTS flow_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS current_node_id text,
  ADD COLUMN IF NOT EXISTS waiting_for text,
  ADD COLUMN IF NOT EXISTS wait_until timestamptz,
  ADD COLUMN IF NOT EXISTS variables jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.marketing_instagram_automation_runs
  DROP CONSTRAINT IF EXISTS marketing_instagram_automation_runs_waiting_for_check;
ALTER TABLE public.marketing_instagram_automation_runs
  ADD CONSTRAINT marketing_instagram_automation_runs_waiting_for_check
  CHECK (waiting_for IS NULL OR waiting_for IN ('reply', 'button'));

ALTER TABLE public.marketing_instagram_automation_runs
  DROP CONSTRAINT IF EXISTS marketing_instagram_automation_runs_status_check;
ALTER TABLE public.marketing_instagram_automation_runs
  ADD CONSTRAINT marketing_instagram_automation_runs_status_check
  CHECK (status IN ('queued', 'running', 'waiting', 'completed', 'partial', 'failed'));

CREATE INDEX IF NOT EXISTS marketing_instagram_automation_runs_waiting_idx
  ON public.marketing_instagram_automation_runs (contact_id, created_at DESC)
  WHERE status = 'waiting';

ALTER TABLE public.marketing_instagram_automation_jobs
  DROP CONSTRAINT IF EXISTS marketing_instagram_automation_jobs_action_type_check;
ALTER TABLE public.marketing_instagram_automation_jobs
  ADD CONSTRAINT marketing_instagram_automation_jobs_action_type_check
  CHECK (action_type IN ('public_reply', 'private_reply', 'dm', 'crm', 'flow_node', 'flow_timeout'));

CREATE INDEX IF NOT EXISTS marketing_instagram_automation_jobs_run_step_idx
  ON public.marketing_instagram_automation_jobs (run_id, step_index DESC);

-- "Ações" counts deliveries and CRM opportunities. Flow blocks such as delays
-- or conditions also complete jobs, so only jobs flagged as counted add up.
CREATE OR REPLACE FUNCTION public.update_instagram_automation_metrics()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_automation_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'marketing_instagram_automation_runs' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.marketing_instagram_automations SET trigger_count = trigger_count + 1 WHERE id = NEW.automation_id;
    ELSIF NEW.status IN ('completed', 'partial', 'failed') AND OLD.status NOT IN ('completed', 'partial', 'failed') THEN
      UPDATE public.marketing_instagram_automations SET
        completed_run_count = completed_run_count + CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
        failed_run_count = failed_run_count + CASE WHEN NEW.status IN ('partial', 'failed') THEN 1 ELSE 0 END
      WHERE id = NEW.automation_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'marketing_instagram_automation_jobs'
    AND NEW.status = 'completed' AND OLD.status <> 'completed'
    AND (NEW.action_type IN ('public_reply', 'private_reply', 'dm', 'crm')
      OR (NEW.action_type = 'flow_node' AND coalesce(NEW.payload->>'counted', 'false') = 'true')) THEN
    SELECT run.automation_id INTO target_automation_id
    FROM public.marketing_instagram_automation_runs run WHERE run.id = NEW.run_id;
    UPDATE public.marketing_instagram_automations SET action_count = action_count + 1 WHERE id = target_automation_id;
  END IF;
  RETURN NEW;
END $$;
