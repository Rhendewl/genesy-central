-- CRM notification rules — central de notificações por etapa de pipeline.
-- Uma regra por (user_id, stage_id) — UNIQUE garante isso.

CREATE TABLE IF NOT EXISTS crm_notification_rules (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  pipeline_id UUID        NOT NULL REFERENCES crm_pipelines(id) ON DELETE CASCADE,
  stage_id    UUID        NOT NULL REFERENCES crm_stages(id)    ON DELETE CASCADE,
  enabled     BOOLEAN     NOT NULL DEFAULT true,
  channels    TEXT[]      NOT NULL DEFAULT ARRAY['pwa'],
  title       TEXT        NOT NULL DEFAULT 'Novo Lead • {{pipeline_name}}',
  body        TEXT        NOT NULL DEFAULT '{{lead_name}} entrou na etapa {{stage_name}}.',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Uma regra por etapa por usuário
  UNIQUE (user_id, stage_id)
);

CREATE INDEX IF NOT EXISTS crm_notification_rules_user_id_idx    ON crm_notification_rules (user_id);
CREATE INDEX IF NOT EXISTS crm_notification_rules_stage_id_idx   ON crm_notification_rules (stage_id);

ALTER TABLE crm_notification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_notification_rules: owner full access"
  ON crm_notification_rules FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION crm_notification_rules_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER crm_notification_rules_updated_at
  BEFORE UPDATE ON crm_notification_rules
  FOR EACH ROW EXECUTE FUNCTION crm_notification_rules_set_updated_at();
