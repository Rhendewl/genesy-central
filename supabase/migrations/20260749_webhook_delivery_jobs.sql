-- Webhooks de formulários: fila durável, idempotente e criada na mesma
-- transação que conclui a submissão.

CREATE TABLE IF NOT EXISTS webhook_delivery_jobs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id   UUID        NOT NULL REFERENCES form_integrations(id) ON DELETE CASCADE,
  form_id           UUID        NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  submission_id     UUID        NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
  event_id          TEXT        NOT NULL,
  correlation_id    TEXT        NOT NULL,
  event_type        TEXT        NOT NULL DEFAULT 'form.submission.completed',
  status            TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'retry', 'delivered', 'dead_letter')),
  attempts          INTEGER     NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts      INTEGER     NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 10),
  next_attempt_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at         TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  last_status_code  INTEGER,
  last_error        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (integration_id, event_id)
);

CREATE INDEX IF NOT EXISTS webhook_delivery_jobs_due_idx
  ON webhook_delivery_jobs(next_attempt_at, created_at)
  WHERE status IN ('pending', 'retry');

CREATE INDEX IF NOT EXISTS webhook_delivery_jobs_submission_idx
  ON webhook_delivery_jobs(submission_id, created_at DESC);

CREATE OR REPLACE FUNCTION enqueue_completed_submission_webhooks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session_correlation TEXT;
BEGIN
  IF NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NEW.correlation_id, s.token, NEW.id::TEXT)
    INTO session_correlation
    FROM form_sessions s
   WHERE s.id = NEW.session_id;

  session_correlation := COALESCE(session_correlation, NEW.id::TEXT);

  INSERT INTO webhook_delivery_jobs (
    integration_id, form_id, submission_id, event_id, correlation_id,
    max_attempts
  )
  SELECT
    fi.id,
    NEW.form_id,
    NEW.id,
    'submission:' || NEW.id::TEXT || ':completed',
    session_correlation,
    LEAST(10, GREATEST(1, CASE
      WHEN COALESCE(fi.retry_policy->>'maxAttempts', '') ~ '^[0-9]+$'
        THEN (fi.retry_policy->>'maxAttempts')::INTEGER
      ELSE 5
    END))
  FROM form_integrations fi
  WHERE fi.form_id = NEW.form_id
    AND fi.adapter = 'webhook'
    AND fi.enabled = TRUE
    AND (
      fi.event_filter IS NULL
      OR cardinality(fi.event_filter) = 0
      OR 'form.submission.completed' = ANY(fi.event_filter)
      OR 'form.submission.succeeded' = ANY(fi.event_filter)
      OR 'form.completed' = ANY(fi.event_filter)
      OR '*' = ANY(fi.event_filter)
    )
  ON CONFLICT (integration_id, event_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS form_submissions_enqueue_webhooks ON form_submissions;
CREATE TRIGGER form_submissions_enqueue_webhooks
  AFTER INSERT OR UPDATE OF status ON form_submissions
  FOR EACH ROW EXECUTE FUNCTION enqueue_completed_submission_webhooks();

ALTER TABLE webhook_delivery_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_delivery_jobs_service_role" ON webhook_delivery_jobs;
CREATE POLICY "webhook_delivery_jobs_service_role"
  ON webhook_delivery_jobs FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "webhook_delivery_jobs_select_owner" ON webhook_delivery_jobs;
CREATE POLICY "webhook_delivery_jobs_select_owner"
  ON webhook_delivery_jobs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM forms
      WHERE forms.id = webhook_delivery_jobs.form_id
        AND forms.user_id = auth.uid()
    )
  );

COMMENT ON TABLE webhook_delivery_jobs IS
  'Fila durável de webhooks de submissões; cada job é idempotente por integração e evento.';
