import type { FormStep } from "@/types";

// ── Submission ────────────────────────────────────────────────────────────────

export type SubmissionStatus =
  | "partial"
  | "started"
  | "completed"
  | "spam"
  | "abandoned";

export type SortField = "created_at" | "completed_at" | "time_on_form_ms";
export type SortDirection = "asc" | "desc";

// Submission row merged with session + form data (list view)
export interface SubmissionListItem {
  id:              string;
  form_id:         string;
  session_id:      string | null;
  correlation_id:  string | null;
  status:          SubmissionStatus;
  answers:         Record<string, unknown>;
  score:           number | null;
  step_timings:    Record<string, number>;
  drop_off_step:   string | null;
  time_on_form_ms: number | null;
  read_at:         string | null;
  starred:         boolean;
  archived:        boolean;
  completed_at:    string | null;
  created_at:      string;
  updated_at:      string;
  // From form_sessions (null if session was deleted)
  session_token:   string | null;
  device:          string | null;
  browser:         string | null;
  os:              string | null;
  country:         string | null;
  city:            string | null;
  utm_source:      string | null;
  utm_medium:      string | null;
  utm_campaign:    string | null;
  utm_term:        string | null;
  utm_content:     string | null;
  fbclid:          string | null;
  gclid:           string | null;
  referrer:        string | null;
  // From forms
  form_name:       string;
  form_slug:       string;
}

// ── Session events (timeline) ─────────────────────────────────────────────────

export interface SessionEvent {
  id:          string;
  step_id:     string | null;
  event:       string;
  duration:    number | null;
  created_at:  string;
  meta:        Record<string, unknown> | null;
}

// ── Integration deliveries ────────────────────────────────────────────────────

export interface IntegrationDelivery {
  id:             string;
  adapter_name:   string;
  event_id:       string;
  correlation_id: string;
  event_type:     string;
  attempt:        number;
  ok:             boolean;
  status_code:    number | null;
  duration_ms:    number | null;
  error:          string | null;
  delivered_at:   string;
}

// ── Detail ────────────────────────────────────────────────────────────────────

export interface SubmissionDetail {
  submission:            SubmissionListItem;
  formSteps:             FormStep[];
  sessionEvents:         SessionEvent[];
  integrationDeliveries: IntegrationDelivery[];
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface SubmissionStats {
  total:           number;
  completed:       number;
  abandoned:       number;
  completionRate:  number;
  avgTimeOnFormMs: number;
}

// ── API responses ─────────────────────────────────────────────────────────────

export interface SubmissionsListResponse {
  items:      SubmissionListItem[];
  nextCursor: string | null;
  stats:      SubmissionStats;
}

// ── Cursor ────────────────────────────────────────────────────────────────────

export interface Cursor {
  ca: string;  // created_at ISO string
  id: string;  // submission uuid
}

// ── Filter params ─────────────────────────────────────────────────────────────

export interface RespostasParams {
  form_id?:   string;
  cursor?:    string;
  limit?:     number;
  q?:         string;
  status?:    SubmissionStatus;
  starred?:   boolean;
  archived?:  boolean;
  sort?:      SortField;
  direction?: SortDirection;
  since?:     string;
  until?:     string;
}

// ── Patch body ────────────────────────────────────────────────────────────────

export interface SubmissionPatch {
  starred?:  boolean;
  archived?: boolean;
  read_at?:  string | null;
  status?:   SubmissionStatus;
}
