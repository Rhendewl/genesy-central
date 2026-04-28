-- ─────────────────────────────────────────────────────────────────────────────
-- 020_add_novo_lead.sql
--
-- Adds 'novo_lead' as the first stage of the CRM funnel.
--
-- Safety rules:
--   • All existing leads stay where they are — NO backfill.
--   • Only future leads (manual, Meta, webhook) land in 'novo_lead'.
--   • The default for kanban_column changes from 'abordados' to 'novo_lead'.
--   • lead_movements has no check constraint on from/to columns — no changes needed.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Drop ALL existing check constraints on leads.kanban_column
--    (handles both the named constraint from 20260426_complete_schema.sql
--     and any auto-named inline constraint from 001_initial.sql)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.leads'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%kanban_column%'
  LOOP
    EXECUTE format('ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS %I', r.conname);
    RAISE NOTICE 'Dropped constraint: %', r.conname;
  END LOOP;
END $$;

-- 2. Add new constraint that includes 'novo_lead' as a valid value
ALTER TABLE public.leads
  ADD CONSTRAINT leads_kanban_column_chk
  CHECK (kanban_column IN (
    'novo_lead',
    'abordados',
    'em_andamento',
    'formulario_aplicado',
    'reuniao_agendada',
    'reuniao_realizada',
    'no_show',
    'venda_realizada'
  ));

-- 3. New leads default to 'novo_lead' from this point forward
ALTER TABLE public.leads
  ALTER COLUMN kanban_column SET DEFAULT 'novo_lead';

-- Verify
DO $$
BEGIN
  RAISE NOTICE 'Migration 020 complete — novo_lead added to kanban_column constraint. Default updated.';
END $$;
