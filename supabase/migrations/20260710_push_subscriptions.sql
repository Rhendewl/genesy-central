-- Push subscriptions — armazena Web Push API subscriptions por usuário.
-- Um usuário pode ter múltiplas subscriptions (vários navegadores/dispositivos).

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    TEXT        NOT NULL,
  p256dh      TEXT        NOT NULL,
  auth_key    TEXT        NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Garante que o mesmo endpoint não seja duplicado por usuário
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON push_subscriptions (user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Usuário gerencia apenas suas próprias subscriptions
CREATE POLICY "push_subscriptions: owner full access"
  ON push_subscriptions FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role pode ler todas (para enviar notificações server-side)
CREATE POLICY "push_subscriptions: service role read"
  ON push_subscriptions FOR SELECT
  USING (true);
