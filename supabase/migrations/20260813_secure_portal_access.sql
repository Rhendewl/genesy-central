-- H-001: portais deixam de ser autorizados apenas pelo slug.
-- Tokens são aleatórios, armazenados somente como SHA-256, expirantes e revogáveis.

CREATE TABLE IF NOT EXISTS portal_access_tokens (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id    UUID        NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  token_hash   TEXT        NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_by   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS portal_access_tokens_hash_idx
  ON portal_access_tokens(token_hash);
CREATE INDEX IF NOT EXISTS portal_access_tokens_portal_idx
  ON portal_access_tokens(portal_id, expires_at DESC);

ALTER TABLE portal_access_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_access_tokens_select_owner" ON portal_access_tokens;
DROP POLICY IF EXISTS "portal_access_tokens_insert_owner" ON portal_access_tokens;
DROP POLICY IF EXISTS "portal_access_tokens_update_owner" ON portal_access_tokens;
DROP POLICY IF EXISTS "portal_access_tokens_delete_owner" ON portal_access_tokens;

CREATE POLICY "portal_access_tokens_select_owner" ON portal_access_tokens FOR SELECT
  USING (EXISTS (SELECT 1 FROM portals p WHERE p.id = portal_id AND p.user_id = public.effective_owner_id()));
CREATE POLICY "portal_access_tokens_insert_owner" ON portal_access_tokens FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM portals p WHERE p.id = portal_id AND p.user_id = public.effective_owner_id())
  );
CREATE POLICY "portal_access_tokens_update_owner" ON portal_access_tokens FOR UPDATE
  USING (EXISTS (SELECT 1 FROM portals p WHERE p.id = portal_id AND p.user_id = public.effective_owner_id()));
CREATE POLICY "portal_access_tokens_delete_owner" ON portal_access_tokens FOR DELETE
  USING (EXISTS (SELECT 1 FROM portals p WHERE p.id = portal_id AND p.user_id = public.effective_owner_id()));

-- Remove leitura anônima dos objetos que definem o escopo de autorização.
DROP POLICY IF EXISTS "portals_select_all" ON portals;
DROP POLICY IF EXISTS "portal_accounts_select_all" ON portal_accounts;
DROP POLICY IF EXISTS "portals_select_owner" ON portals;
DROP POLICY IF EXISTS "portal_accounts_select_owner" ON portal_accounts;

CREATE POLICY "portals_select_owner" ON portals FOR SELECT
  USING (public.effective_owner_id() = user_id);
CREATE POLICY "portal_accounts_select_owner" ON portal_accounts FOR SELECT
  USING (EXISTS (SELECT 1 FROM portals p WHERE p.id = portal_id AND p.user_id = public.effective_owner_id()));
