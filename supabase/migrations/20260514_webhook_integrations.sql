-- ── Webhook integrations ──────────────────────────────────────────────────────
-- One record per user. Stores the API key and aggregate stats.

CREATE TABLE IF NOT EXISTS webhook_integrations (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL DEFAULT 'Webhook',
  api_key          TEXT        NOT NULL UNIQUE,
  leads_count      INTEGER     NOT NULL DEFAULT 0,
  last_received_at TIMESTAMPTZ,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One webhook integration per user
CREATE UNIQUE INDEX IF NOT EXISTS webhook_integrations_user_id_key
  ON webhook_integrations(user_id);

CREATE INDEX IF NOT EXISTS webhook_integrations_api_key_idx
  ON webhook_integrations(api_key);

-- ── Webhook logs ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhook_logs (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID        REFERENCES webhook_integrations(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL,
  received_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload        JSONB,
  status         TEXT        NOT NULL DEFAULT 'processed'
                               CHECK (status IN ('processed', 'duplicate', 'error', 'invalid_key')),
  lead_id        UUID,
  error_message  TEXT
);

CREATE INDEX IF NOT EXISTS webhook_logs_integration_id_idx ON webhook_logs(integration_id);
CREATE INDEX IF NOT EXISTS webhook_logs_user_id_idx        ON webhook_logs(user_id);
CREATE INDEX IF NOT EXISTS webhook_logs_received_at_idx    ON webhook_logs(received_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE webhook_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_webhook_integrations"
  ON webhook_integrations FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_webhook_logs"
  ON webhook_logs FOR ALL USING (auth.uid() = user_id);

-- Service role (webhook handler) can write without a session
CREATE POLICY "service_role_webhook_logs"
  ON webhook_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_webhook_integrations"
  ON webhook_integrations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE TRIGGER update_webhook_integrations_updated_at
  BEFORE UPDATE ON webhook_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Atomic counter RPC ────────────────────────────────────────────────────────
-- Called from the webhook handler to avoid race conditions on leads_count.

CREATE OR REPLACE FUNCTION increment_webhook_leads_count(p_integration_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE webhook_integrations
  SET leads_count      = leads_count + 1,
      last_received_at = NOW(),
      updated_at       = NOW()
  WHERE id = p_integration_id;
$$;
