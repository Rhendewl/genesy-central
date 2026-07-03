// ─────────────────────────────────────────────────────────────────────────────
// Appointments Module — TypeScript Types
//
// Domain model: Calendar is the primary aggregate.
// Booking is the consequence (visitor reserves a slot on a Calendar).
// ─────────────────────────────────────────────────────────────────────────────

// ── Enums / Literal Types ────────────────────────────────────────────────────

export type AppointmentCalendarStatus = "active" | "archived";

export type AppointmentLocationType = "in_person" | "online" | "phone" | "other";

export type AppointmentMeetingProvider =
  | "google_meet"
  | "zoom"
  | "teams"
  | "whereby"
  | "whatsapp"
  | "custom"
  | "none";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show"
  | "rescheduled";

export type BookingActor = "visitor" | "admin" | "system";

export type BookingCancelledBy = "visitor" | "admin" | "system";

export type BookingHistoryEventType =
  | "created"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show"
  | "rescheduled"
  | "note_added"
  | "google_synced"
  | "google_sync_failed"
  | "email_sent"
  | "reminder_sent"
  | "webhook_delivered"
  | "webhook_failed"
  | "status_changed";

export type AvailabilityExceptionType = "blocked" | "custom_hours";

export type CalendarMemberRole = "organizer" | "viewer";

export type ConversionTriggerEvent =
  | "booking.created"
  | "booking.confirmed"
  | "booking.completed";

// ── Custom Fields ────────────────────────────────────────────────────────────

export type AppointmentCustomFieldType =
  | "text" | "number" | "email" | "phone" | "url"
  | "date" | "time" | "select" | "multiselect"
  | "checkbox" | "radio" | "textarea";

export interface AppointmentCustomField {
  id:           string;
  label:        string;
  type:         AppointmentCustomFieldType;
  required:     boolean;
  placeholder?: string;
  help?:        string;
  order:        number;
  options?:     string[];   // for select, multiselect, radio, checkbox
}

// ── Calendar settings (stored in appointment_calendars.settings jsonb) ────────

export type StandardFieldVisibility = "required" | "optional" | "hidden";

export interface AppointmentPageSettings {
  title:           string | null;
  subtitle:        string | null;
  welcome_message: string | null;
  cover_image_url: string | null;
  logo_url:        string | null;
  brand_color:     string;    // hex, default "#6366f1"
}

export interface AppointmentFormSettings {
  standard_fields: {
    phone:   StandardFieldVisibility;
    company: StandardFieldVisibility;
    role:    StandardFieldVisibility;
    city:    StandardFieldVisibility;
    notes:   StandardFieldVisibility;
  };
}

export interface AppointmentSuccessSettings {
  title:        string;
  message:      string;
  button_label: string | null;
  redirect_url: string | null;
}

export interface AppointmentLGPDSettings {
  enabled: boolean;
  title:   string;
  text:    string;
  link:    string | null;
}

export interface AppointmentCrmSettings {
  enabled:     boolean;
  pipeline_id: string | null;
  stage_id:    string | null;
}

export interface AppointmentMetaPixelSettings {
  enabled:          boolean;
  pixel_id:         string;
  event_name:       string;              // e.g. "Chronos_Scheduled", "Lead", custom
  event_mode:       "standard" | "custom";
  access_token:     string;              // AES-256-GCM encrypted via encryptToken()
  test_event_code?: string | null;
}

export interface AppointmentCalendarSettings {
  page?:       AppointmentPageSettings;
  form?:       AppointmentFormSettings;
  success?:    AppointmentSuccessSettings;
  lgpd?:       AppointmentLGPDSettings;
  crm?:        AppointmentCrmSettings;
  meta_pixel?: AppointmentMetaPixelSettings;
}

// ── Calendar aggregate ───────────────────────────────────────────────────────

export interface AppointmentCalendar {
  id:                    string;
  user_id:               string;
  name:                  string;
  slug:                  string;
  description:           string | null;
  duration_minutes:      number;
  location_type:         AppointmentLocationType | null;
  location:              string | null;
  meeting_provider:      AppointmentMeetingProvider;
  custom_meeting_url:    string | null;
  timezone:              string;
  booking_window_days:   number;
  min_notice_hours:      number;
  buffer_before_minutes: number;
  buffer_after_minutes:  number;
  daily_limit:           number | null;
  capacity_per_slot:     number;
  status:                AppointmentCalendarStatus;
  custom_fields:         AppointmentCustomField[];
  settings:              AppointmentCalendarSettings;
  created_at:            string;
  updated_at:            string;
}

export type NewAppointmentCalendar = Omit<
  AppointmentCalendar,
  "id" | "user_id" | "created_at" | "updated_at"
>;

export type UpdateAppointmentCalendar = Partial<NewAppointmentCalendar>;

// ── Availability rules (weekly schedule) ─────────────────────────────────────

export interface AppointmentAvailabilityRule {
  id:           string;
  calendar_id:  string;
  user_id:      string;
  day_of_week:  number;    // 0=Sunday … 6=Saturday
  start_time:   string;    // "HH:MM:SS" from Postgres time type
  end_time:     string;
  is_available: boolean;
  created_at:   string;
}

export type NewAppointmentAvailabilityRule = Pick<
  AppointmentAvailabilityRule,
  "day_of_week" | "start_time" | "end_time" | "is_available"
>;

// ── Availability exceptions (date-specific overrides) ────────────────────────

export interface AppointmentAvailabilityException {
  id:             string;
  calendar_id:    string;
  user_id:        string;
  exception_date: string;    // "YYYY-MM-DD"
  type:           AvailabilityExceptionType;
  start_time:     string | null;
  end_time:       string | null;
  reason:         string | null;
  created_at:     string;
}

export type NewAppointmentAvailabilityException = Pick<
  AppointmentAvailabilityException,
  "exception_date" | "type" | "start_time" | "end_time" | "reason"
>;

// ── Attribution block (collected on public booking page) ─────────────────────

export interface BookingAttribution {
  utm_source?:    string;
  utm_medium?:    string;
  utm_campaign?:  string;
  utm_content?:   string;
  utm_term?:      string;
  fbclid?:        string;
  gclid?:         string;
  fbp?:           string;
  fbc?:           string;
  ip?:            string;
  user_agent?:    string;
  page_url?:      string;
  referrer?:      string;
}

// ── Booking entity ────────────────────────────────────────────────────────────

export interface AppointmentBooking {
  id:             string;
  calendar_id:    string;
  user_id:        string;
  organizer_id:   string;

  // Identity block
  visitor_name:   string;
  visitor_email:  string;
  visitor_phone:  string | null;
  visitor_notes:  string | null;
  visitor_timezone: string;

  // Scheduling block
  starts_at:      string;
  ends_at:        string;
  status:         BookingStatus;
  location_type:  AppointmentLocationType | null;
  location:       string | null;
  meeting_url:    string | null;

  // Tokens
  cancel_token:                   string | null;
  reschedule_token:               string | null;
  cancel_token_expires_at:        string | null;
  reschedule_token_expires_at:    string | null;

  // Status transitions
  cancelled_at:        string | null;
  cancelled_by:        BookingCancelledBy | null;
  cancellation_reason: string | null;
  confirmed_at:        string | null;
  completed_at:        string | null;

  // Rescheduling chain
  rescheduled_from_id: string | null;

  // Custom form responses
  custom_form_responses: Record<string, unknown>;

  // Attribution block
  correlation_id: string | null;
  attribution:    BookingAttribution;

  // CRM block
  submission_id: string | null;
  lead_id:       string | null;
  session_id:    string | null;

  // Integration block
  google_event_id:    string | null;
  google_calendar_id: string | null;

  created_at: string;
  updated_at: string;
}

// ── Booking history (audit trail) ────────────────────────────────────────────

export interface AppointmentBookingHistory {
  id:         string;
  booking_id: string;
  user_id:    string;
  event_type: BookingHistoryEventType;
  actor:      BookingActor;
  actor_id:   string | null;
  payload:    Record<string, unknown>;
  created_at: string;
}

// ── Google connection ─────────────────────────────────────────────────────────

export interface AppointmentGoogleConnection {
  id:                   string;
  user_id:              string;
  google_account_email: string;
  access_token:         string;
  refresh_token:        string;
  token_expires_at:     string | null;
  scopes:               string[];
  is_active:            boolean;
  last_sync_at:         string | null;
  last_error:           string | null;
  created_at:           string;
  updated_at:           string;
}

// ── Google calendar ───────────────────────────────────────────────────────────

export interface AppointmentGoogleCalendar {
  id:                        string;
  connection_id:             string;
  calendar_id:               string;
  user_id:                   string;
  google_calendar_id:        string;
  google_calendar_name:      string | null;
  use_for_conflicts:         boolean;
  google_webhook_channel_id: string | null;
  google_webhook_resource_id: string | null;
  google_webhook_expiry:     string | null;
  created_at:                string;
}

// ── Reminder config ───────────────────────────────────────────────────────────

export interface AppointmentReminder {
  id:             string;
  calendar_id:    string;
  user_id:        string;
  timing_minutes: number;
  recipient:      "visitor" | "organizer" | "both";
  channel:        "email";
  is_active:      boolean;
  created_at:     string;
}

// ── Conversion rules ──────────────────────────────────────────────────────────

export interface AppointmentConversion {
  id:            string;
  calendar_id:   string;
  user_id:       string;
  trigger_event: ConversionTriggerEvent;
  platform:      "meta_pixel" | "google_ads" | "tiktok_pixel";
  settings:      Record<string, unknown>;
  enabled:       boolean;
  created_at:    string;
  updated_at:    string;
}

// ── Calendar member (V2) ──────────────────────────────────────────────────────

export interface AppointmentCalendarMember {
  id:             string;
  calendar_id:    string;
  member_user_id: string;
  owner_user_id:  string;
  role:           CalendarMemberRole;
  created_at:     string;
}

// ── Scheduling Engine types ───────────────────────────────────────────────────

export interface TimeWindow {
  startTime: string;  // "HH:MM"
  endTime:   string;  // "HH:MM"
}

export interface AdminSlot {
  startsAt:      string;  // ISO UTC timestamp
  endsAt:        string;  // ISO UTC timestamp
  startsAtLocal: string;  // "HH:MM" in calendar timezone
  dateLabel:     string;  // Formatted date string
}

// Slot exposed to the public booking page (Phase 2+)
export interface PublicSlot extends AdminSlot {
  startsAtVisitorLocal: string;  // "HH:MM" in visitor timezone
}

// ── Composed/derived types ────────────────────────────────────────────────────

export interface AppointmentCalendarWithAvailability extends AppointmentCalendar {
  availability_rules:      AppointmentAvailabilityRule[];
  availability_exceptions: AppointmentAvailabilityException[];
}

export interface AppointmentCalendarListItem extends AppointmentCalendar {
  upcoming_bookings_count: number;
}

// ── API payload types ─────────────────────────────────────────────────────────

export interface UpsertAvailabilityRulesPayload {
  rules: NewAppointmentAvailabilityRule[];
}

export interface CreateAvailabilityExceptionPayload
  extends NewAppointmentAvailabilityException {}

export interface GetSlotsQuery {
  date:              string;  // "YYYY-MM-DD"
  visitor_timezone?: string;  // optional for admin preview
}

// ── Public calendar (safe to expose without authentication) ───────────────────

export interface PublicCalendar {
  id:                  string;
  name:                string;
  slug:                string;
  description:         string | null;
  duration_minutes:    number;
  timezone:            string;
  meeting_provider:    AppointmentMeetingProvider;
  location_type:       AppointmentLocationType | null;
  location:            string | null;
  custom_meeting_url:  string | null;
  booking_window_days: number;
  min_notice_hours:    number;
  capacity_per_slot:   number;
  custom_fields:       AppointmentCustomField[];
  settings:            AppointmentCalendarSettings;
}

// ── Public booking creation ───────────────────────────────────────────────────

export interface CreatePublicBookingPayload {
  starts_at:             string;    // ISO UTC timestamp
  visitor_name:          string;
  visitor_email:         string;
  visitor_phone?:        string;
  visitor_company?:      string;
  visitor_role?:         string;
  visitor_city?:         string;
  visitor_notes?:        string;
  visitor_timezone:      string;
  custom_form_responses: Record<string, unknown>;
  attribution?:          BookingAttribution;
  lgpd_accepted?:        boolean;
}

export interface PublicBookingResult {
  booking_id:   string;
  starts_at:    string;
  ends_at:      string;
  cancel_token: string;
}

export interface BookingWithCalendar extends AppointmentBooking {
  calendar_name: string;
}
