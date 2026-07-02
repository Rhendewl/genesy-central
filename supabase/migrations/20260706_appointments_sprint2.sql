-- ============================================================
-- Appointments Sprint 2 — Public Booking Page
--
-- DB changes (idempotent, backwards-compatible):
-- 1. Fast index for public slug lookup (no user_id required)
--
-- No new tables needed. appointment_bookings is already complete:
--   visitor_name, visitor_email, visitor_phone, visitor_notes,
--   visitor_timezone, custom_form_responses, attribution, etc.
--
-- Page config lives in appointment_calendars.settings (jsonb).
-- Custom form fields live in appointment_calendars.custom_fields (jsonb).
-- Both columns already exist from migration 20260703.
-- ============================================================

-- Fast lookup by slug for the public booking page.
-- The existing UNIQUE INDEX is keyed by (user_id, slug) and cannot be
-- used for unauthenticated queries that only know the slug.
CREATE INDEX IF NOT EXISTS appointment_calendars_public_slug_idx
  ON appointment_calendars (slug)
  WHERE status = 'active';
