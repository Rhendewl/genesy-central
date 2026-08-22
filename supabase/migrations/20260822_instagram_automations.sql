-- Instagram professional account automations (comments and messaging).
-- Delivery is performed by a service-role worker; dashboard access follows the
-- same organization/admin model as the rest of the Marketing module.

ALTER TABLE public.marketing_instagram_connections
  ADD COLUMN IF NOT EXISTS requested_scopes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS webhook_subscribed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS webhook_fields text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS webhook_error text;

CREATE TABLE IF NOT EXISTS public.marketing_instagram_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  connection_id uuid NOT NULL REFERENCES public.marketing_instagram_connections(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused')),
  trigger_type text NOT NULL CHECK (trigger_type IN ('comment', 'message', 'story_reply', 'postback')),
  match_type text NOT NULL DEFAULT 'contains' CHECK (match_type IN ('contains', 'exact', 'starts_with', 'any')),
  keywords text[] NOT NULL DEFAULT '{}',
  public_reply_text text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  crm_enabled boolean NOT NULL DEFAULT false,
  crm_pipeline_id uuid REFERENCES public.crm_pipelines(id) ON DELETE SET NULL,
  crm_stage_id uuid REFERENCES public.crm_stages(id) ON DELETE SET NULL,
  trigger_count bigint NOT NULL DEFAULT 0,
  completed_run_count bigint NOT NULL DEFAULT 0,
  failed_run_count bigint NOT NULL DEFAULT 0,
  action_count bigint NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_instagram_automations_match_idx
  ON public.marketing_instagram_automations (connection_id, trigger_type, status);

CREATE TABLE IF NOT EXISTS public.marketing_instagram_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  connection_id uuid NOT NULL REFERENCES public.marketing_instagram_connections(id) ON DELETE CASCADE,
  instagram_scoped_id text NOT NULL,
  username text,
  crm_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  last_inbound_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, instagram_scoped_id)
);

CREATE TABLE IF NOT EXISTS public.marketing_instagram_automation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  connection_id uuid NOT NULL REFERENCES public.marketing_instagram_connections(id) ON DELETE CASCADE,
  external_event_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('comment', 'message', 'story_reply', 'postback')),
  sender_scoped_id text,
  sender_username text,
  comment_id text,
  media_id text,
  message_id text,
  text text,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'matched', 'ignored')),
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, external_event_id)
);

CREATE INDEX IF NOT EXISTS marketing_instagram_automation_events_metrics_idx
  ON public.marketing_instagram_automation_events (organization_id, occurred_at DESC, status);

CREATE TABLE IF NOT EXISTS public.marketing_instagram_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  automation_id uuid NOT NULL REFERENCES public.marketing_instagram_automations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.marketing_instagram_automation_events(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.marketing_instagram_contacts(id) ON DELETE SET NULL,
  crm_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'partial', 'failed')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (automation_id, event_id)
);

CREATE INDEX IF NOT EXISTS marketing_instagram_automation_runs_metrics_idx
  ON public.marketing_instagram_automation_runs (organization_id, created_at DESC, status);

CREATE TABLE IF NOT EXISTS public.marketing_instagram_automation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  run_id uuid NOT NULL REFERENCES public.marketing_instagram_automation_runs(id) ON DELETE CASCADE,
  step_index integer NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('public_reply', 'private_reply', 'dm', 'crm')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'retry', 'completed', 'dead_letter', 'skipped')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 10),
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  last_error text,
  external_message_id text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, step_index)
);

CREATE INDEX IF NOT EXISTS marketing_instagram_automation_jobs_worker_idx
  ON public.marketing_instagram_automation_jobs (scheduled_for, created_at)
  WHERE status IN ('pending', 'retry');

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
    AND NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    SELECT run.automation_id INTO target_automation_id
    FROM public.marketing_instagram_automation_runs run WHERE run.id = NEW.run_id;
    UPDATE public.marketing_instagram_automations SET action_count = action_count + 1 WHERE id = target_automation_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS instagram_automation_run_metrics ON public.marketing_instagram_automation_runs;
CREATE TRIGGER instagram_automation_run_metrics
  AFTER INSERT OR UPDATE OF status ON public.marketing_instagram_automation_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_instagram_automation_metrics();
DROP TRIGGER IF EXISTS instagram_automation_job_metrics ON public.marketing_instagram_automation_jobs;
CREATE TRIGGER instagram_automation_job_metrics
  AFTER UPDATE OF status ON public.marketing_instagram_automation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_instagram_automation_metrics();

ALTER TABLE public.marketing_instagram_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_instagram_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_instagram_automation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_instagram_automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_instagram_automation_jobs ENABLE ROW LEVEL SECURITY;

-- Marketing members may read automation activity. Only the organization owner
-- or an active admin may configure automations. Worker writes use service_role.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'marketing_instagram_automations', 'marketing_instagram_contacts',
    'marketing_instagram_automation_events', 'marketing_instagram_automation_runs',
    'marketing_instagram_automation_jobs'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_select', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (
        %I.organization_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.user_profiles profile
          WHERE profile.auth_user_id = auth.uid()
            AND profile.owner_id = %I.organization_id
            AND profile.is_active = true
            AND (profile.role = ''admin'' OR profile.permissions ? ''marketing'')
        )
      )', table_name || '_select', table_name, table_name, table_name
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS marketing_instagram_automations_manage ON public.marketing_instagram_automations;
CREATE POLICY marketing_instagram_automations_manage ON public.marketing_instagram_automations
  FOR ALL USING (
    organization_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.user_profiles profile
      WHERE profile.auth_user_id = auth.uid()
        AND profile.owner_id = marketing_instagram_automations.organization_id
        AND profile.is_active = true AND profile.role = 'admin'
    )
  ) WITH CHECK (
    organization_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.user_profiles profile
      WHERE profile.auth_user_id = auth.uid()
        AND profile.owner_id = marketing_instagram_automations.organization_id
        AND profile.is_active = true AND profile.role = 'admin'
    )
  );

DROP POLICY IF EXISTS marketing_instagram_automation_worker_jobs ON public.marketing_instagram_automation_jobs;
CREATE POLICY marketing_instagram_automation_worker_jobs
  ON public.marketing_instagram_automation_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS marketing_instagram_automation_worker_events ON public.marketing_instagram_automation_events;
CREATE POLICY marketing_instagram_automation_worker_events
  ON public.marketing_instagram_automation_events FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS marketing_instagram_automation_worker_runs ON public.marketing_instagram_automation_runs;
CREATE POLICY marketing_instagram_automation_worker_runs
  ON public.marketing_instagram_automation_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS marketing_instagram_automation_worker_contacts ON public.marketing_instagram_contacts;
CREATE POLICY marketing_instagram_automation_worker_contacts
  ON public.marketing_instagram_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.marketing_instagram_automation_jobs IS
  'Durable, idempotent Instagram action queue with retries and dead-letter state.';
