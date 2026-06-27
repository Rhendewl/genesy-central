-- Phase 5: Integration configurations and delivery log

CREATE TABLE IF NOT EXISTS form_integrations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id      UUID        NOT NULL REFERENCES formularios(id) ON DELETE CASCADE,
  adapter      TEXT        NOT NULL CHECK (adapter IN ('meta-pixel', 'ga4', 'webhook', 'crm')),
  enabled      BOOLEAN     NOT NULL DEFAULT true,
  settings     JSONB       NOT NULL DEFAULT '{}',
  secrets      JSONB       NOT NULL DEFAULT '{}',        -- encrypted at rest
  event_filter TEXT[],
  retry_policy JSONB,
  rate_limit   JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS form_integrations_form_id_idx
  ON form_integrations(form_id)
  WHERE enabled = true;

-- Delivery log for observability and debugging (no dashboard in this phase).
CREATE TABLE IF NOT EXISTS integration_deliveries (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID        NOT NULL REFERENCES form_integrations(id) ON DELETE CASCADE,
  event_id       TEXT        NOT NULL,
  correlation_id TEXT        NOT NULL,
  event_type     TEXT        NOT NULL,
  attempt        INTEGER     NOT NULL DEFAULT 1,
  ok             BOOLEAN     NOT NULL,
  status_code    INTEGER,
  duration_ms    INTEGER,
  error          TEXT,
  delivered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS integration_deliveries_event_id_idx
  ON integration_deliveries(event_id, integration_id);

CREATE INDEX IF NOT EXISTS integration_deliveries_delivered_at_idx
  ON integration_deliveries(delivered_at DESC);

-- Automatically update form_integrations.updated_at on any row change.
CREATE OR REPLACE FUNCTION update_form_integrations_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_form_integrations_updated_at ON form_integrations;
CREATE TRIGGER trg_form_integrations_updated_at
  BEFORE UPDATE ON form_integrations
  FOR EACH ROW EXECUTE FUNCTION update_form_integrations_updated_at();
