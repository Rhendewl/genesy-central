-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 20260503: Fix team member RLS — definitive version
--
-- Problem: 20260426_complete_schema.sql redefines apply_standard_rls using
-- auth.uid() instead of effective_owner_id(), overwriting migration 022.
-- Also 20260426_nps_records.sql and 20260427_integrations.sql use auth.uid().
--
-- Fix: Re-apply effective_owner_id() to every table and trigger.
-- Runs last (alphabetically after all existing migrations).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Core helper ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.effective_owner_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(
    (SELECT owner_id FROM public.user_profiles
     WHERE auth_user_id = auth.uid()
     LIMIT 1),
    auth.uid()
  );
$$;

-- ── 2. Auto-set trigger function ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auto_set_owner_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.user_id := public.effective_owner_id();
  RETURN NEW;
END;
$$;

-- ── 3. Apply BEFORE INSERT trigger to all data tables ────────────────────────

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'tags','leads','categories','lancamentos','clientes_recorrentes',
    'investimentos_diarios','agency_clients','contracts','revenues',
    'expenses','recurring_revenues','traffic_costs','financial_goals',
    'collections','traffic_client_settings','campaigns','campaign_metrics',
    'ad_platform_accounts','traffic_monthly_goals','meta_tokens',
    'meta_page_subscriptions','meta_form_subscriptions','meta_sync_logs',
    'client_cost_shares','portals','nps_records','security_settings',
    'security_logs','company_profile','integrations'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_auto_owner_%I ON public.%I',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE TRIGGER trg_auto_owner_%I
       BEFORE INSERT ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.auto_set_owner_id()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ── 4. Updated apply_standard_rls using effective_owner_id() ─────────────────

CREATE OR REPLACE FUNCTION public.apply_standard_rls(tbl text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_select', tbl);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_insert', tbl);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_update', tbl);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_delete', tbl);
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR SELECT USING (public.effective_owner_id() = user_id)',
    tbl || '_select', tbl
  );
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (public.effective_owner_id() = user_id)',
    tbl || '_insert', tbl
  );
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR UPDATE USING (public.effective_owner_id() = user_id)',
    tbl || '_update', tbl
  );
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR DELETE USING (public.effective_owner_id() = user_id)',
    tbl || '_delete', tbl
  );
END;
$$;

-- ── 5. Re-apply standard RLS to all data tables ───────────────────────────────

SELECT public.apply_standard_rls('tags');
SELECT public.apply_standard_rls('leads');
SELECT public.apply_standard_rls('categories');
SELECT public.apply_standard_rls('lancamentos');
SELECT public.apply_standard_rls('clientes_recorrentes');
SELECT public.apply_standard_rls('investimentos_diarios');
SELECT public.apply_standard_rls('agency_clients');
SELECT public.apply_standard_rls('client_cost_shares');
SELECT public.apply_standard_rls('contracts');
SELECT public.apply_standard_rls('revenues');
SELECT public.apply_standard_rls('expenses');
SELECT public.apply_standard_rls('recurring_revenues');
SELECT public.apply_standard_rls('traffic_costs');
SELECT public.apply_standard_rls('financial_goals');
SELECT public.apply_standard_rls('collections');
SELECT public.apply_standard_rls('traffic_client_settings');
SELECT public.apply_standard_rls('campaigns');
SELECT public.apply_standard_rls('campaign_metrics');
SELECT public.apply_standard_rls('ad_platform_accounts');
SELECT public.apply_standard_rls('traffic_monthly_goals');
SELECT public.apply_standard_rls('meta_tokens');
SELECT public.apply_standard_rls('meta_page_subscriptions');
SELECT public.apply_standard_rls('meta_form_subscriptions');
SELECT public.apply_standard_rls('meta_sync_logs');
SELECT public.apply_standard_rls('nps_records');
SELECT public.apply_standard_rls('security_settings');
SELECT public.apply_standard_rls('security_logs');
SELECT public.apply_standard_rls('company_profile');

-- ── 6. lead_movements — via leads join ───────────────────────────────────────

ALTER TABLE public.lead_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lead_movements_select   ON public.lead_movements;
DROP POLICY IF EXISTS "lead_movements_select" ON public.lead_movements;
DROP POLICY IF EXISTS lead_movements_insert   ON public.lead_movements;
DROP POLICY IF EXISTS "lead_movements_insert" ON public.lead_movements;
DROP POLICY IF EXISTS lead_movements_update   ON public.lead_movements;
DROP POLICY IF EXISTS "lead_movements_update" ON public.lead_movements;
DROP POLICY IF EXISTS lead_movements_delete   ON public.lead_movements;
DROP POLICY IF EXISTS "lead_movements_delete" ON public.lead_movements;

CREATE POLICY "lead_movements_select" ON public.lead_movements FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.user_id = public.effective_owner_id())
);
CREATE POLICY "lead_movements_insert" ON public.lead_movements FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.user_id = public.effective_owner_id())
);
CREATE POLICY "lead_movements_update" ON public.lead_movements FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.user_id = public.effective_owner_id())
);
CREATE POLICY "lead_movements_delete" ON public.lead_movements FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.user_id = public.effective_owner_id())
);

-- ── 7. portals — members have full access ────────────────────────────────────

ALTER TABLE public.portals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS portals_select          ON public.portals;
DROP POLICY IF EXISTS "portals_select"        ON public.portals;
DROP POLICY IF EXISTS "portals_select_owner"  ON public.portals;
DROP POLICY IF EXISTS "portals_select_all"    ON public.portals;
DROP POLICY IF EXISTS portals_insert          ON public.portals;
DROP POLICY IF EXISTS "portals_insert"        ON public.portals;
DROP POLICY IF EXISTS "portals_insert_owner"  ON public.portals;
DROP POLICY IF EXISTS portals_update          ON public.portals;
DROP POLICY IF EXISTS "portals_update"        ON public.portals;
DROP POLICY IF EXISTS "portals_update_owner"  ON public.portals;
DROP POLICY IF EXISTS portals_delete          ON public.portals;
DROP POLICY IF EXISTS "portals_delete"        ON public.portals;
DROP POLICY IF EXISTS "portals_delete_owner"  ON public.portals;

CREATE POLICY "portals_select" ON public.portals FOR SELECT USING (public.effective_owner_id() = user_id);
CREATE POLICY "portals_insert" ON public.portals FOR INSERT WITH CHECK (public.effective_owner_id() = user_id);
CREATE POLICY "portals_update" ON public.portals FOR UPDATE USING (public.effective_owner_id() = user_id);
CREATE POLICY "portals_delete" ON public.portals FOR DELETE USING (public.effective_owner_id() = user_id);

-- ── 8. portal_accounts — via portals join ────────────────────────────────────

ALTER TABLE public.portal_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "portal_accounts_select"       ON public.portal_accounts;
DROP POLICY IF EXISTS "portal_accounts_select_all"   ON public.portal_accounts;
DROP POLICY IF EXISTS "portal_accounts_insert"       ON public.portal_accounts;
DROP POLICY IF EXISTS "portal_accounts_insert_owner" ON public.portal_accounts;
DROP POLICY IF EXISTS "portal_accounts_update"       ON public.portal_accounts;
DROP POLICY IF EXISTS "portal_accounts_delete"       ON public.portal_accounts;
DROP POLICY IF EXISTS "portal_accounts_delete_owner" ON public.portal_accounts;

CREATE POLICY "portal_accounts_select" ON public.portal_accounts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.portals p WHERE p.id = portal_id AND p.user_id = public.effective_owner_id())
);
CREATE POLICY "portal_accounts_insert" ON public.portal_accounts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.portals p WHERE p.id = portal_id AND p.user_id = public.effective_owner_id())
);
CREATE POLICY "portal_accounts_delete" ON public.portal_accounts FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.portals p WHERE p.id = portal_id AND p.user_id = public.effective_owner_id())
);

-- ── 9. meta_webhook_logs — user_id can be NULL ───────────────────────────────

ALTER TABLE public.meta_webhook_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS meta_webhook_logs_select ON public.meta_webhook_logs;
DROP POLICY IF EXISTS meta_webhook_logs_insert ON public.meta_webhook_logs;
DROP POLICY IF EXISTS meta_webhook_logs_update ON public.meta_webhook_logs;

CREATE POLICY "meta_webhook_logs_select" ON public.meta_webhook_logs
  FOR SELECT USING (public.effective_owner_id() = user_id OR user_id IS NULL);
CREATE POLICY "meta_webhook_logs_insert" ON public.meta_webhook_logs
  FOR INSERT WITH CHECK (true);
CREATE POLICY "meta_webhook_logs_update" ON public.meta_webhook_logs
  FOR UPDATE USING (public.effective_owner_id() = user_id OR user_id IS NULL);

-- ── 10. integrations ─────────────────────────────────────────────────────────

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "integrations_select" ON public.integrations;
DROP POLICY IF EXISTS "integrations_insert" ON public.integrations;
DROP POLICY IF EXISTS "integrations_update" ON public.integrations;
DROP POLICY IF EXISTS "integrations_delete" ON public.integrations;

CREATE POLICY "integrations_select" ON public.integrations FOR SELECT USING (public.effective_owner_id() = user_id);
CREATE POLICY "integrations_insert" ON public.integrations FOR INSERT WITH CHECK (public.effective_owner_id() = user_id);
CREATE POLICY "integrations_update" ON public.integrations FOR UPDATE USING (public.effective_owner_id() = user_id);
CREATE POLICY "integrations_delete" ON public.integrations FOR DELETE USING (public.effective_owner_id() = user_id);

-- ── 11. user_profiles — owner manages team, member reads own row ─────────────

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_profiles_select              ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select"            ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_own"        ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_member_select_own" ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_insert              ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert"            ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_own"        ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_update              ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update"            ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_own"        ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_delete              ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete"            ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete_own"        ON public.user_profiles;

CREATE POLICY "user_profiles_select" ON public.user_profiles
  FOR SELECT USING (auth.uid() = owner_id OR auth.uid() = auth_user_id);
CREATE POLICY "user_profiles_insert" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "user_profiles_update" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "user_profiles_delete" ON public.user_profiles
  FOR DELETE USING (auth.uid() = owner_id);

-- ── 12. user_invites — owner-only ────────────────────────────────────────────

ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_invites_select       ON public.user_invites;
DROP POLICY IF EXISTS "user_invites_select"     ON public.user_invites;
DROP POLICY IF EXISTS "user_invites_select_own" ON public.user_invites;
DROP POLICY IF EXISTS user_invites_insert       ON public.user_invites;
DROP POLICY IF EXISTS "user_invites_insert"     ON public.user_invites;
DROP POLICY IF EXISTS "user_invites_insert_own" ON public.user_invites;
DROP POLICY IF EXISTS user_invites_update       ON public.user_invites;
DROP POLICY IF EXISTS "user_invites_update"     ON public.user_invites;
DROP POLICY IF EXISTS "user_invites_update_own" ON public.user_invites;
DROP POLICY IF EXISTS user_invites_delete       ON public.user_invites;
DROP POLICY IF EXISTS "user_invites_delete"     ON public.user_invites;
DROP POLICY IF EXISTS "user_invites_delete_own" ON public.user_invites;

CREATE POLICY "user_invites_select" ON public.user_invites FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "user_invites_insert" ON public.user_invites FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "user_invites_update" ON public.user_invites FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "user_invites_delete" ON public.user_invites FOR DELETE USING (auth.uid() = owner_id);
