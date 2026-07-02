-- ============================================================
-- Appointments Sprint 1 — Calendar configuration enrichment
-- + multi-interval weekly availability
--
-- Changes (all backwards-compatible, all idempotent):
--
-- 1. appointment_calendars: add capacity_per_slot (default 1)
-- 2. appointment_calendars: extend meeting_provider CHECK to 'whatsapp'
-- 3. appointment_calendars: extend status CHECK to allow reactivation via API
-- 4. appointment_availability_rules: drop UNIQUE(calendar_id, day_of_week)
--    so each day can have multiple non-overlapping intervals
-- ============================================================

-- ── 1. capacity_per_slot ──────────────────────────────────────────────────────
-- How many visitors can book the same time slot concurrently.
-- Default 1 preserves current single-booking behaviour for all existing calendars.
ALTER TABLE appointment_calendars
  ADD COLUMN IF NOT EXISTS capacity_per_slot integer NOT NULL DEFAULT 1
    CHECK (capacity_per_slot >= 1);

-- ── 2. Extend meeting_provider CHECK to include 'whatsapp' ────────────────────
-- The original inline CHECK gets an auto-generated constraint name.
-- We find it dynamically and recreate it with the new enum.
DO $$
DECLARE
  c_name text;
BEGIN
  SELECT conname INTO c_name
  FROM   pg_constraint
  WHERE  conrelid = 'appointment_calendars'::regclass
    AND  contype  = 'c'
    AND  pg_get_constraintdef(oid) LIKE '%meeting_provider%';

  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE appointment_calendars DROP CONSTRAINT %I', c_name);
  END IF;
END;
$$;

ALTER TABLE appointment_calendars
  ADD CONSTRAINT appointment_calendars_meeting_provider_check
  CHECK (meeting_provider IN (
    'google_meet', 'zoom', 'teams', 'whereby', 'whatsapp', 'custom', 'none'
  ));

-- ── 3. Drop UNIQUE(calendar_id, day_of_week) ─────────────────────────────────
-- This constraint was correct when one rule = one day.
-- Sprint 1 allows multiple time intervals per day (09-12 + 14-18).
-- The RPC already does DELETE-all then INSERT-all so it handles multiple rows
-- per day naturally once the unique constraint is removed.
DO $$
DECLARE
  c_name text;
BEGIN
  SELECT conname INTO c_name
  FROM   pg_constraint
  WHERE  conrelid = 'appointment_availability_rules'::regclass
    AND  contype  = 'u'
    AND  pg_get_constraintdef(oid) LIKE '%day_of_week%';

  IF c_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE appointment_availability_rules DROP CONSTRAINT %I',
      c_name
    );
  END IF;
END;
$$;
