-- =============================================================================
-- Portais Module — dashboards públicos para clientes
-- Idempotente: pode ser executado várias vezes sem erro
-- Executar no Supabase → SQL Editor → New query → Run
-- =============================================================================

-- ── Tabela principal ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS portals (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id  UUID        REFERENCES agency_clients(id) ON DELETE SET NULL,
  name       TEXT        NOT NULL,
  slug       TEXT        NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'ativo'
               CHECK (status IN ('ativo', 'pausado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS portals_slug_idx      ON portals(slug);
CREATE INDEX        IF NOT EXISTS portals_user_id_idx   ON portals(user_id);
CREATE INDEX        IF NOT EXISTS portals_client_id_idx ON portals(client_id);

-- Trigger updated_at — usa a função que já existe no banco de produção
DROP TRIGGER IF EXISTS portals_updated_at ON portals;
CREATE TRIGGER portals_updated_at
  BEFORE UPDATE ON portals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Contas de anúncios vinculadas ao portal ───────────────────────────────────

CREATE TABLE IF NOT EXISTS portal_accounts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id      UUID        NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  ad_account_id  TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS portal_accounts_unique        ON portal_accounts(portal_id, ad_account_id);
CREATE INDEX        IF NOT EXISTS portal_accounts_portal_id_idx ON portal_accounts(portal_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE portals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_accounts ENABLE ROW LEVEL SECURITY;

-- portals: público pode ler (rota pública usa slug), dono gerencia
DROP POLICY IF EXISTS "portals_select_all"   ON portals;
DROP POLICY IF EXISTS "portals_insert_owner" ON portals;
DROP POLICY IF EXISTS "portals_update_owner" ON portals;
DROP POLICY IF EXISTS "portals_delete_owner" ON portals;

CREATE POLICY "portals_select_all"   ON portals FOR SELECT USING (true);
CREATE POLICY "portals_insert_owner" ON portals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "portals_update_owner" ON portals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "portals_delete_owner" ON portals FOR DELETE USING (auth.uid() = user_id);

-- portal_accounts: público pode ler, dono gerencia via propriedade do portal
DROP POLICY IF EXISTS "portal_accounts_select_all"   ON portal_accounts;
DROP POLICY IF EXISTS "portal_accounts_insert_owner" ON portal_accounts;
DROP POLICY IF EXISTS "portal_accounts_delete_owner" ON portal_accounts;

CREATE POLICY "portal_accounts_select_all" ON portal_accounts FOR SELECT USING (true);

CREATE POLICY "portal_accounts_insert_owner" ON portal_accounts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM portals
      WHERE portals.id = portal_accounts.portal_id
        AND portals.user_id = auth.uid()
    )
  );

CREATE POLICY "portal_accounts_delete_owner" ON portal_accounts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM portals
      WHERE portals.id = portal_accounts.portal_id
        AND portals.user_id = auth.uid()
    )
  );
