-- ============================================================
-- Appointments Module — Full Schema
-- Calendar is the primary aggregate. Booking is its consequence.
-- Phase 1 implements: Calendars, Availability, Slot Engine.
-- Remaining tables created now as stubs for future phases.
-- ============================================================

-- ── appointment_calendars ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS appointment_calendars (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                   text        NOT NULL,
  slug                   text        NOT NULL,
  description            text,
  duration_minutes       integer     NOT NULL DEFAULT 30,
  location_type          text        CHECK (location_type IN ('in_person', 'online', 'phone', 'other')),
  location               text,
  meeting_provider       text        NOT NULL DEFAULT 'none'
                                     CHECK (meeting_provider IN ('google_meet', 'zoom', 'teams', 'whereby', 'custom', 'none')),
  custom_meeting_url     text,
  timezone               text        NOT NULL DEFAULT 'America/Sao_Paulo',
  booking_window_days    integer     NOT NULL DEFAULT 60,
  min_notice_hours       integer     NOT NULL DEFAULT 1,
  buffer_before_minutes  integer     NOT NULL DEFAULT 0,
  buffer_after_minutes   integer     NOT NULL DEFAULT 0,
  daily_limit            integer,
  status                 text        NOT NULL DEFAULT 'active'
                                     CHECK (status IN ('active', 'archived')),
  custom_fields          jsonb       NOT NULL DEFAULT '[]',
  settings               jsonb       NOT NULL DEFAULT '{}',
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE appointment_calendars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointment_calendars_owner" ON appointment_calendars;
CREATE POLICY "appointment_calendars_owner"
  ON appointment_calendars
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS appointment_calendars_slug_user_idx
  ON appointment_calendars (user_id, slug)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS appointment_calendars_user_id_idx
  ON appointment_calendars (user_id);

CREATE TRIGGER appointment_calendars_updated_at
  BEFORE UPDATE ON appointment_calendars
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── appointment_availability_rules ────────────────────────────
-- Weekly schedule: which days and times the calendar accepts bookings.

CREATE TABLE IF NOT EXISTS appointment_availability_rules (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id uuid    NOT NULL REFERENCES appointment_calendars(id) ON DELETE CASCADE,
  user_id     uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time  time    NOT NULL,
  end_time    time    NOT NULL,
  is_available boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (calendar_id, day_of_week)
);

ALTER TABLE appointment_availability_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointment_availability_rules_owner" ON appointment_availability_rules;
CREATE POLICY "appointment_availability_rules_owner"
  ON appointment_availability_rules
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS appointment_availability_rules_calendar_idx
  ON appointment_availability_rules (calendar_id);

-- ── appointment_availability_exceptions ───────────────────────
-- Date-specific overrides: block a day or set custom hours.

CREATE TABLE IF NOT EXISTS appointment_availability_exceptions (
  id             uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id    uuid  NOT NULL REFERENCES appointment_calendars(id) ON DELETE CASCADE,
  user_id        uuid  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exception_date date  NOT NULL,
  type           text  NOT NULL CHECK (type IN ('blocked', 'custom_hours')),
  start_time     time,
  end_time       time,
  reason         text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (calendar_id, exception_date)
);

ALTER TABLE appointment_availability_exceptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointment_availability_exceptions_owner" ON appointment_availability_exceptions;
CREATE POLICY "appointment_availability_exceptions_owner"
  ON appointment_availability_exceptions
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS appointment_availability_exceptions_calendar_date_idx
  ON appointment_availability_exceptions (calendar_id, exception_date);

-- ── appointment_bookings ──────────────────────────────────────
-- Booking entity: a visitor's reservation on a calendar slot.
-- Phase 2 implements the booking flow. Table created now.

CREATE TABLE IF NOT EXISTS appointment_bookings (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id             uuid        NOT NULL REFERENCES appointment_calendars(id) ON DELETE RESTRICT,
  user_id                 uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organizer_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity block (PRD Ch. 30.2.1)
  visitor_name            text        NOT NULL,
  visitor_email           text        NOT NULL,
  visitor_phone           text,
  visitor_notes           text,
  visitor_timezone        text        NOT NULL,

  -- Scheduling block (PRD Ch. 30.2.2)
  starts_at               timestamptz NOT NULL,
  ends_at                 timestamptz NOT NULL,
  status                  text        NOT NULL DEFAULT 'pending'
                                      CHECK (status IN ('pending','confirmed','cancelled','completed','no_show','rescheduled')),
  location_type           text,
  location                text,
  meeting_url             text,

  -- Metadata block — public access tokens
  cancel_token            text        UNIQUE,
  reschedule_token        text        UNIQUE,
  cancel_token_expires_at     timestamptz,
  reschedule_token_expires_at timestamptz,

  -- Status transitions
  cancelled_at            timestamptz,
  cancelled_by            text        CHECK (cancelled_by IN ('visitor','admin','system')),
  cancellation_reason     text,
  confirmed_at            timestamptz,
  completed_at            timestamptz,

  -- Rescheduling chain
  rescheduled_from_id     uuid        REFERENCES appointment_bookings(id) ON DELETE SET NULL,

  -- Custom form responses
  custom_form_responses   jsonb       NOT NULL DEFAULT '{}',

  -- Attribution block (PRD Ch. 30.2.4)
  correlation_id          text,
  attribution             jsonb       NOT NULL DEFAULT '{}',

  -- CRM block (PRD Ch. 30.2.5)
  submission_id           uuid,
  lead_id                 uuid,
  session_id              uuid,

  -- Integration block (PRD Ch. 30.2.6)
  google_event_id         text,
  google_calendar_id      text,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE appointment_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointment_bookings_owner" ON appointment_bookings;
CREATE POLICY "appointment_bookings_owner"
  ON appointment_bookings
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS appointment_bookings_calendar_id_idx
  ON appointment_bookings (calendar_id);

CREATE INDEX IF NOT EXISTS appointment_bookings_user_id_idx
  ON appointment_bookings (user_id);

CREATE INDEX IF NOT EXISTS appointment_bookings_starts_at_idx
  ON appointment_bookings (starts_at);

CREATE INDEX IF NOT EXISTS appointment_bookings_status_idx
  ON appointment_bookings (status);

CREATE INDEX IF NOT EXISTS appointment_bookings_visitor_email_idx
  ON appointment_bookings (visitor_email);

CREATE INDEX IF NOT EXISTS appointment_bookings_lead_id_idx
  ON appointment_bookings (lead_id)
  WHERE lead_id IS NOT NULL;

-- Composite index for ConflictResolver — the hot path
CREATE INDEX IF NOT EXISTS appointment_bookings_conflict_idx
  ON appointment_bookings (calendar_id, starts_at, ends_at)
  WHERE status IN ('pending', 'confirmed');

CREATE INDEX IF NOT EXISTS appointment_bookings_cancel_token_idx
  ON appointment_bookings (cancel_token)
  WHERE cancel_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS appointment_bookings_reschedule_token_idx
  ON appointment_bookings (reschedule_token)
  WHERE reschedule_token IS NOT NULL;

CREATE TRIGGER appointment_bookings_updated_at
  BEFORE UPDATE ON appointment_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── appointment_booking_history ───────────────────────────────
-- Append-only audit trail. No UPDATE or DELETE via RLS.

CREATE TABLE IF NOT EXISTS appointment_booking_history (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id     uuid        NOT NULL REFERENCES appointment_bookings(id) ON DELETE CASCADE,
  user_id        uuid        NOT NULL,
  event_type     text        NOT NULL
                             CHECK (event_type IN (
                               'created','confirmed','cancelled','completed','no_show',
                               'rescheduled','note_added','google_synced','google_sync_failed',
                               'email_sent','reminder_sent','webhook_delivered','webhook_failed',
                               'status_changed'
                             )),
  actor          text        NOT NULL CHECK (actor IN ('visitor','admin','system')),
  actor_id       uuid,
  payload        jsonb       NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE appointment_booking_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointment_booking_history_select" ON appointment_booking_history;
CREATE POLICY "appointment_booking_history_select"
  ON appointment_booking_history FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "appointment_booking_history_insert" ON appointment_booking_history;
CREATE POLICY "appointment_booking_history_insert"
  ON appointment_booking_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS appointment_booking_history_booking_idx
  ON appointment_booking_history (booking_id, created_at DESC);

-- ── appointment_google_connections ────────────────────────────
-- Google OAuth credentials per user. Phase Google implements this.

CREATE TABLE IF NOT EXISTS appointment_google_connections (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  google_account_email  text        NOT NULL,
  access_token          text        NOT NULL,
  refresh_token         text        NOT NULL,
  token_expires_at      timestamptz,
  scopes                text[]      NOT NULL DEFAULT '{}',
  is_active             boolean     NOT NULL DEFAULT true,
  last_sync_at          timestamptz,
  last_error            text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE appointment_google_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointment_google_connections_owner" ON appointment_google_connections;
CREATE POLICY "appointment_google_connections_owner"
  ON appointment_google_connections
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER appointment_google_connections_updated_at
  BEFORE UPDATE ON appointment_google_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── appointment_google_calendars ──────────────────────────────
-- Which Google calendar to use for conflict checking per calendar.

CREATE TABLE IF NOT EXISTS appointment_google_calendars (
  id                         uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id              uuid  NOT NULL REFERENCES appointment_google_connections(id) ON DELETE CASCADE,
  calendar_id                uuid  NOT NULL UNIQUE REFERENCES appointment_calendars(id) ON DELETE CASCADE,
  user_id                    uuid  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_calendar_id         text  NOT NULL,
  google_calendar_name       text,
  use_for_conflicts          boolean NOT NULL DEFAULT true,
  google_webhook_channel_id  text,
  google_webhook_resource_id text,
  google_webhook_expiry      timestamptz,
  created_at                 timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE appointment_google_calendars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointment_google_calendars_owner" ON appointment_google_calendars;
CREATE POLICY "appointment_google_calendars_owner"
  ON appointment_google_calendars
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── appointment_reminders ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS appointment_reminders (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id     uuid    NOT NULL REFERENCES appointment_calendars(id) ON DELETE CASCADE,
  user_id         uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timing_minutes  integer NOT NULL,
  recipient       text    NOT NULL CHECK (recipient IN ('visitor','organizer','both')),
  channel         text    NOT NULL DEFAULT 'email' CHECK (channel IN ('email')),
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE appointment_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointment_reminders_owner" ON appointment_reminders;
CREATE POLICY "appointment_reminders_owner"
  ON appointment_reminders
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS appointment_reminders_calendar_idx
  ON appointment_reminders (calendar_id);

-- ── appointment_reminder_logs ─────────────────────────────────

CREATE TABLE IF NOT EXISTS appointment_reminder_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid        NOT NULL REFERENCES appointment_bookings(id) ON DELETE CASCADE,
  reminder_id uuid        NOT NULL REFERENCES appointment_reminders(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_at     timestamptz NOT NULL DEFAULT now(),
  status      text        NOT NULL CHECK (status IN ('sent','failed')),
  error       text
);

ALTER TABLE appointment_reminder_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointment_reminder_logs_owner" ON appointment_reminder_logs;
CREATE POLICY "appointment_reminder_logs_owner"
  ON appointment_reminder_logs FOR SELECT
  USING (auth.uid() = user_id);

-- ── appointment_webhooks ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS appointment_webhooks (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id    uuid    REFERENCES appointment_calendars(id) ON DELETE CASCADE,
  user_id        uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url            text    NOT NULL,
  events         text[]  NOT NULL DEFAULT '{}',
  signing_secret text    NOT NULL,
  is_active      boolean NOT NULL DEFAULT true,
  last_success_at timestamptz,
  last_error      text,
  last_error_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE appointment_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointment_webhooks_owner" ON appointment_webhooks;
CREATE POLICY "appointment_webhooks_owner"
  ON appointment_webhooks
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER appointment_webhooks_updated_at
  BEFORE UPDATE ON appointment_webhooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── appointment_conversions ───────────────────────────────────
-- Conversion rules per calendar (parallel to crm_stage_conversions).
-- trigger_event maps to appointment domain events published by CalendarService.

CREATE TABLE IF NOT EXISTS appointment_conversions (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id   uuid    NOT NULL REFERENCES appointment_calendars(id) ON DELETE CASCADE,
  user_id       uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_event text    NOT NULL
                        CHECK (trigger_event IN (
                          'booking.created',
                          'booking.confirmed',
                          'booking.completed'
                        )),
  platform      text    NOT NULL
                        CHECK (platform IN ('meta_pixel','google_ads','tiktok_pixel')),
  settings      jsonb   NOT NULL DEFAULT '{}',
  enabled       boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (calendar_id, trigger_event, platform)
);

ALTER TABLE appointment_conversions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointment_conversions_owner" ON appointment_conversions;
CREATE POLICY "appointment_conversions_owner"
  ON appointment_conversions
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER appointment_conversions_updated_at
  BEFORE UPDATE ON appointment_conversions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── appointment_calendar_members ──────────────────────────────
-- Team members per calendar (V2 multi-organizer). Table created now.

CREATE TABLE IF NOT EXISTS appointment_calendar_members (
  id             uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id    uuid  NOT NULL REFERENCES appointment_calendars(id) ON DELETE CASCADE,
  member_user_id uuid  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_user_id  uuid  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role           text  NOT NULL CHECK (role IN ('organizer','viewer')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (calendar_id, member_user_id)
);

ALTER TABLE appointment_calendar_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointment_calendar_members_owner" ON appointment_calendar_members;
CREATE POLICY "appointment_calendar_members_owner"
  ON appointment_calendar_members
  USING  (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE INDEX IF NOT EXISTS appointment_calendar_members_calendar_idx
  ON appointment_calendar_members (calendar_id);
