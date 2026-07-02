-- ============================================================
-- Appointments Module — Concurrency & Atomicity
--
-- Adds two production-critical guarantees that require
-- a separate migration because they alter existing tables:
--
-- 1. EXCLUDE USING gist: database-level overlapping-booking prevention.
-- 2. appointments_upsert_availability_rules RPC: atomic weekly-schedule
--    replace (delete + insert in a single transaction).
-- ============================================================

-- btree_gist is a trusted Supabase extension.
-- Required to use the equality operator (=) on uuid inside a GIST index.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ── Layer 2: database-level race condition protection ─────────────────────────
--
-- Prevents two bookings from occupying the same time window on the same
-- calendar, even under concurrent requests that both pass the application-level
-- conflict check (ConflictResolver) simultaneously.
--
-- Semantics: tstzrange(starts_at, ends_at, '[)') is a half-open interval —
-- a booking at 10:00–11:00 does NOT conflict with one at 11:00–12:00. ✓
--
-- Only active bookings (pending or confirmed) are included; cancelled /
-- completed / rescheduled / no_show rows are excluded from the check.
ALTER TABLE appointment_bookings
  ADD CONSTRAINT appointment_bookings_no_overlap
  EXCLUDE USING gist (
    calendar_id                              WITH =,
    tstzrange(starts_at, ends_at, '[)')      WITH &&
  )
  WHERE (status IN ('pending', 'confirmed'));

-- ── Atomic availability rules upsert ─────────────────────────────────────────
--
-- Replaces the entire weekly schedule (delete-all then insert-all) inside a
-- single PostgreSQL transaction. The Supabase JS client has no raw-transaction
-- API, so we use an RPC to enforce atomicity at the database level.
--
-- Security model: SECURITY INVOKER (default) — the function runs under the
-- calling user's session, so Supabase RLS on appointment_availability_rules
-- applies automatically. auth.uid() is set by PostgREST from the JWT.
--
-- Error codes (raised as exceptions so the client can inspect them):
--   UNAUTHENTICATED      — no valid session
--   CALENDAR_NOT_FOUND   — calendar doesn't belong to the calling user

CREATE OR REPLACE FUNCTION appointments_upsert_availability_rules(
  p_calendar_id uuid,
  p_rules       jsonb    -- array of {day_of_week, start_time, end_time, is_available}
)
RETURNS SETOF appointment_availability_rules
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  -- Verify ownership AND that the calendar is still active.
  -- Archived calendars must not have their schedule changed.
  IF NOT EXISTS (
    SELECT 1 FROM appointment_calendars
    WHERE  id      = p_calendar_id
    AND    user_id = v_user_id
    AND    status  = 'active'
  ) THEN
    RAISE EXCEPTION 'CALENDAR_NOT_FOUND';
  END IF;

  -- Atomic replace: delete existing schedule, then insert new one.
  -- Both statements run in the same transaction — if the INSERT fails
  -- (e.g., constraint violation), the DELETE is rolled back.
  DELETE FROM appointment_availability_rules
  WHERE  calendar_id = p_calendar_id
  AND    user_id     = v_user_id;

  IF jsonb_array_length(COALESCE(p_rules, '[]'::jsonb)) > 0 THEN
    INSERT INTO appointment_availability_rules
      (calendar_id, user_id, day_of_week, start_time, end_time, is_available)
    SELECT
      p_calendar_id,
      v_user_id,
      (rule->>'day_of_week')::integer,
      (rule->>'start_time')::time,
      (rule->>'end_time')::time,
      COALESCE((rule->>'is_available')::boolean, true)
    FROM jsonb_array_elements(p_rules) AS rule;
  END IF;

  -- Return the persisted rows so the caller can update its local state.
  RETURN QUERY
    SELECT * FROM appointment_availability_rules
    WHERE  calendar_id = p_calendar_id
    AND    user_id     = v_user_id
    ORDER BY day_of_week;
END;
$$;
