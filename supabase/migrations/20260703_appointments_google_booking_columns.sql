-- Adds google_event_id and google_calendar_id to appointment_bookings
-- so the sync service can persist the Google Calendar event reference.

ALTER TABLE appointment_bookings
  ADD COLUMN IF NOT EXISTS google_event_id    text,
  ADD COLUMN IF NOT EXISTS google_calendar_id text;
