-- Permissões por submódulo no Marketing + membros com "somente as contas que conectar".
--
-- O membro com o escopo "marketing.instagram:own" só lê as contas do Instagram
-- em que connected_by = ele e os dados ligados a elas; pode conectar as próprias
-- contas e gerenciar automações nelas. Dono e admins continuam vendo tudo;
-- membros de Marketing sem o escopo continuam lendo tudo, como antes.
--
-- Idempotente e tolerante a tabelas ausentes (ex.: account_insights em bancos
-- onde aquela migration não foi aplicada): cada política só é criada se a
-- tabela existir.

-- ── Funções de acesso ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.marketing_instagram_connection_access(
  p_organization_id uuid,
  p_connection_id uuid,
  p_manage boolean DEFAULT false
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.marketing_instagram_connections c
    WHERE c.id = p_connection_id
      AND c.organization_id = p_organization_id
      AND (
        c.organization_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_profiles p
          WHERE p.auth_user_id = auth.uid()
            AND p.owner_id = c.organization_id
            AND p.is_active = true
            AND (
              p.role = 'admin'
              OR (
                p.permissions ? 'marketing'
                AND p.permissions ? 'marketing.instagram:own'
                AND c.connected_by = auth.uid()
              )
              OR (
                NOT p_manage
                AND p.permissions ? 'marketing'
                AND NOT p.permissions ? 'marketing.instagram:own'
              )
            )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.marketing_instagram_automation_access(
  p_organization_id uuid,
  p_automation_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.marketing_instagram_automations a
    WHERE a.id = p_automation_id
      AND a.organization_id = p_organization_id
      AND public.marketing_instagram_connection_access(a.organization_id, a.connection_id, false)
  );
$$;

CREATE OR REPLACE FUNCTION public.marketing_instagram_run_access(
  p_organization_id uuid,
  p_run_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.marketing_instagram_automation_runs r
    WHERE r.id = p_run_id
      AND r.organization_id = p_organization_id
      AND public.marketing_instagram_automation_access(r.organization_id, r.automation_id)
  );
$$;

REVOKE ALL ON FUNCTION public.marketing_instagram_connection_access(uuid, uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.marketing_instagram_automation_access(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.marketing_instagram_run_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketing_instagram_connection_access(uuid, uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.marketing_instagram_automation_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.marketing_instagram_run_access(uuid, uuid) TO authenticated, service_role;

-- ── Contas conectadas (usa as colunas da própria linha) ─────────────────────

DROP POLICY IF EXISTS marketing_instagram_connections_select ON public.marketing_instagram_connections;
CREATE POLICY marketing_instagram_connections_select ON public.marketing_instagram_connections
  FOR SELECT USING (
    organization_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles profile
      WHERE profile.auth_user_id = auth.uid()
        AND profile.owner_id = marketing_instagram_connections.organization_id
        AND profile.is_active = true
        AND (
          profile.role = 'admin'
          OR (profile.permissions ? 'marketing' AND NOT profile.permissions ? 'marketing.instagram:own')
          OR (
            profile.permissions ? 'marketing'
            AND profile.permissions ? 'marketing.instagram:own'
            AND marketing_instagram_connections.connected_by = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS marketing_instagram_connections_manage ON public.marketing_instagram_connections;
CREATE POLICY marketing_instagram_connections_manage ON public.marketing_instagram_connections
  FOR ALL USING (
    organization_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles profile
      WHERE profile.auth_user_id = auth.uid()
        AND profile.owner_id = marketing_instagram_connections.organization_id
        AND profile.is_active = true
        AND (
          profile.role = 'admin'
          OR (
            profile.permissions ? 'marketing'
            AND profile.permissions ? 'marketing.instagram:own'
            AND marketing_instagram_connections.connected_by = auth.uid()
          )
        )
    )
  )
  WITH CHECK (
    organization_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles profile
      WHERE profile.auth_user_id = auth.uid()
        AND profile.owner_id = marketing_instagram_connections.organization_id
        AND profile.is_active = true
        AND (
          profile.role = 'admin'
          OR (
            profile.permissions ? 'marketing'
            AND profile.permissions ? 'marketing.instagram:own'
            AND marketing_instagram_connections.connected_by = auth.uid()
          )
        )
    )
  );

CREATE INDEX IF NOT EXISTS marketing_instagram_connections_connected_by_idx
  ON public.marketing_instagram_connections (organization_id, connected_by);

-- ── Demais tabelas (só as que existirem neste banco) ────────────────────────

DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('marketing_instagram_media',              'public.marketing_instagram_connection_access(organization_id, connection_id, false)'),
      ('marketing_instagram_account_insights',   'public.marketing_instagram_connection_access(organization_id, connection_id, false)'),
      ('marketing_instagram_automations',        'public.marketing_instagram_connection_access(organization_id, connection_id, false)'),
      ('marketing_instagram_contacts',           'public.marketing_instagram_connection_access(organization_id, connection_id, false)'),
      ('marketing_instagram_automation_events',  'public.marketing_instagram_connection_access(organization_id, connection_id, false)'),
      ('marketing_instagram_automation_runs',    'public.marketing_instagram_automation_access(organization_id, automation_id)'),
      ('marketing_instagram_automation_jobs',    'public.marketing_instagram_run_access(organization_id, run_id)')
    ) AS t(table_name, rule)
  LOOP
    IF to_regclass('public.' || item.table_name) IS NULL THEN
      RAISE NOTICE 'Tabela % não existe; política ignorada.', item.table_name;
      CONTINUE;
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', item.table_name || '_select', item.table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (%s)', item.table_name || '_select', item.table_name, item.rule);
  END LOOP;

  -- Escrita nas automações: dono, admin ou membro dono da conta.
  IF to_regclass('public.marketing_instagram_automations') IS NOT NULL THEN
    DROP POLICY IF EXISTS marketing_instagram_automations_manage ON public.marketing_instagram_automations;
    CREATE POLICY marketing_instagram_automations_manage ON public.marketing_instagram_automations
      FOR ALL USING (
        public.marketing_instagram_connection_access(organization_id, connection_id, true)
      ) WITH CHECK (
        public.marketing_instagram_connection_access(organization_id, connection_id, true)
      );
  END IF;
END $$;
