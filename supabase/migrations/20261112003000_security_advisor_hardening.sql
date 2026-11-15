-- Applied through Supabase Studio on 2026-11-12 (UTC).
-- Preserve existing definitions, grants and SECURITY DEFINER helpers used by RLS.
BEGIN;

ALTER VIEW public.v_churn_monthly SET (security_invoker = true);
ALTER VIEW public.v_client_profitability SET (security_invoker = true);
ALTER VIEW public.v_mrr_snapshot SET (security_invoker = true);
ALTER VIEW public.v_nps_monthly SET (security_invoker = true);
ALTER VIEW public.v_revenue_summary SET (security_invoker = true);

DO $fix$
DECLARE
  f record;
BEGIN
  -- public must remain trusted before including it in a definer search path.
  IF has_schema_privilege('anon', 'public', 'CREATE')
     OR has_schema_privilege('authenticated', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'Public schema must be trusted';
  END IF;

  FOR f IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_proc'::regclass
          AND d.objid = p.oid AND d.deptype = 'e'
      )
      AND NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) s WHERE s LIKE 'search_path=%'
      )
  LOOP
    -- Keep unqualified application references working; pg_temp must be last.
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path = pg_catalog, public, pg_temp',
      f.signature
    );
  END LOOP;
END
$fix$;

-- Relocate, rather than recreate, so existing GiST constraints keep their OIDs.
ALTER EXTENSION btree_gist SET SCHEMA extensions;

COMMIT;
