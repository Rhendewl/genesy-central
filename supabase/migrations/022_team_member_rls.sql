-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 022: Team member data access
--
-- Problem: RLS policies use auth.uid() = user_id, so team members (who have a
-- different auth.uid()) see no data. They should see and interact with the
-- same data as their owner.
--
-- Solution:
--   1. effective_owner_id() — returns owner_id for team members, auth.uid() for owners
--   2. BEFORE INSERT trigger auto-sets user_id = effective_owner_id() on all data tables
--      so app code never needs to know the owner's UUID
--   3. All RLS policies updated to use effective_owner_id() = user_id
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Core helper function ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.effective_owner_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(
    (SELECT owner_id FROM public.user_profiles
     WHERE auth_user_id = auth.uid()
     LIMIT 1),
    auth.uid()
  );
$$;

-- ── 2. BEFORE INSERT trigger: auto-set user_id to effective owner ─────────────

CREATE OR REPLACE FUNCTION public.auto_set_owner_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.user_id := public.effective_owner_id();
  RETURN NEW;
END;
$$;

-- Apply trigger to all main data tables
DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'tags','leads','categories','lancamentos','clientes_recorrentes',
    'investimentos_diarios','agency_clients','contracts','revenues',
    'expenses','recurring_revenues','traffic_costs','financial_goals',
    'collections','traffic_client_settings','campaigns','campaign_metrics',
    'ad_platform_accounts','traffic_monthly_goals','meta_tokens',
    'meta_sync_logs','client_cost_shares','portals','nps_records'
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

-- ── 3. Updated apply_standard_rls using effective_owner_id() ─────────────────

CREATE OR REPLACE FUNCTION public.apply_standard_rls(tbl text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_select', tbl);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_insert', tbl);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_update', tbl);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_delete', tbl);
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR SELECT
     USING (public.effective_owner_id() = user_id)',
    tbl || '_select', tbl
  );
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR INSERT
     WITH CHECK (public.effective_owner_id() = user_id)',
    tbl || '_insert', tbl
  );
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR UPDATE
     USING (public.effective_owner_id() = user_id)',
    tbl || '_update', tbl
  );
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR DELETE
     USING (public.effective_owner_id() = user_id)',
    tbl || '_delete', tbl
  );
END;
$$;

-- Re-apply to every table that uses standard RLS
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

-- ── 4. Manually-defined policies that need updating ──────────────────────────

-- lead_movements: access allowed if the parent lead belongs to effective owner
DROP POLICY IF EXISTS "lead_movements_select" ON public.lead_movements;
DROP POLICY IF EXISTS "lead_movements_insert" ON public.lead_movements;
DROP POLICY IF EXISTS "lead_movements_update" ON public.lead_movements;
DROP POLICY IF EXISTS "lead_movements_delete" ON public.lead_movements;
CREATE POLICY "lead_movements_select" ON public.lead_movements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_movements.lead_id
        AND l.user_id = public.effective_owner_id()
    )
  );
CREATE POLICY "lead_movements_insert" ON public.lead_movements
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_movements.lead_id
        AND l.user_id = public.effective_owner_id()
    )
  );
CREATE POLICY "lead_movements_update" ON public.lead_movements
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_movements.lead_id
        AND l.user_id = public.effective_owner_id()
    )
  );
CREATE POLICY "lead_movements_delete" ON public.lead_movements
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_movements.lead_id
        AND l.user_id = public.effective_owner_id()
    )
  );

-- portals: members can SELECT, only owner can INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "portals_select_owner"  ON public.portals;
DROP POLICY IF EXISTS "portals_insert_owner"  ON public.portals;
DROP POLICY IF EXISTS "portals_update_owner"  ON public.portals;
DROP POLICY IF EXISTS "portals_delete_owner"  ON public.portals;
CREATE POLICY "portals_select_owner" ON public.portals
  FOR SELECT USING (public.effective_owner_id() = user_id);
CREATE POLICY "portals_insert_owner" ON public.portals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "portals_update_owner" ON public.portals
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "portals_delete_owner" ON public.portals
  FOR DELETE USING (auth.uid() = user_id);

-- portal_accounts: update to use effective owner
DROP POLICY IF EXISTS "portal_accounts_select" ON public.portal_accounts;
DROP POLICY IF EXISTS "portal_accounts_insert" ON public.portal_accounts;
DROP POLICY IF EXISTS "portal_accounts_update" ON public.portal_accounts;
DROP POLICY IF EXISTS "portal_accounts_delete" ON public.portal_accounts;
CREATE POLICY "portal_accounts_select" ON public.portal_accounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.portals p
      WHERE p.id = portal_accounts.portal_id
        AND p.user_id = public.effective_owner_id()
    )
  );
CREATE POLICY "portal_accounts_insert" ON public.portal_accounts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.portals p
      WHERE p.id = portal_accounts.portal_id
        AND p.user_id = auth.uid()
    )
  );
CREATE POLICY "portal_accounts_update" ON public.portal_accounts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.portals p
      WHERE p.id = portal_accounts.portal_id
        AND p.user_id = auth.uid()
    )
  );
CREATE POLICY "portal_accounts_delete" ON public.portal_accounts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.portals p
      WHERE p.id = portal_accounts.portal_id
        AND p.user_id = auth.uid()
    )
  );

-- integrations table (from 20260427)
DROP POLICY IF EXISTS "integrations_select" ON public.integrations;
DROP POLICY IF EXISTS "integrations_insert" ON public.integrations;
DROP POLICY IF EXISTS "integrations_update" ON public.integrations;
DROP POLICY IF EXISTS "integrations_delete" ON public.integrations;
CREATE POLICY "integrations_select" ON public.integrations
  FOR SELECT USING (public.effective_owner_id() = user_id);
CREATE POLICY "integrations_insert" ON public.integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "integrations_update" ON public.integrations
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "integrations_delete" ON public.integrations
  FOR DELETE USING (auth.uid() = user_id);

-- company_profile: members can read, only owner writes
DROP POLICY IF EXISTS "company_profile_select" ON public.company_profile;
DROP POLICY IF EXISTS "company_profile_insert" ON public.company_profile;
DROP POLICY IF EXISTS "company_profile_update" ON public.company_profile;
CREATE POLICY "company_profile_select" ON public.company_profile
  FOR SELECT USING (public.effective_owner_id() = user_id);
CREATE POLICY "company_profile_insert" ON public.company_profile
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "company_profile_update" ON public.company_profile
  FOR UPDATE USING (auth.uid() = user_id);
