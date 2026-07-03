// ── Google Calendar Integration Types ─────────────────────────────────────────
// access_token and refresh_token are stored AES-256-GCM encrypted in DB.
// These types never expose the raw token values to the client.

export type GoogleSyncStatus = "idle" | "syncing" | "success" | "error";

export interface GoogleCalendarConnection {
  id:                     string;
  user_id:                string;
  google_account_email:   string;
  google_account_name:    string | null;
  google_account_picture: string | null;
  token_expires_at:       string | null;
  scopes:                 string[];
  is_active:              boolean;
  auto_create_events:     boolean;
  last_sync_at:           string | null;
  last_sync_status:       GoogleSyncStatus;
  last_error:             string | null;
  created_at:             string;
  updated_at:             string;
}

// Internal DB row — includes encrypted token fields (server-only)
export interface GoogleCalendarConnectionRow extends GoogleCalendarConnection {
  access_token:  string;  // AES-256-GCM encrypted
  refresh_token: string;  // AES-256-GCM encrypted
}

// Public shape returned by GET /api/google-calendar/status (no tokens)
export interface GoogleConnectionStatus {
  connected:  boolean;
  connection: Omit<GoogleCalendarConnection, "user_id"> | null;
}

// Google OAuth token exchange response
export interface GoogleTokenResponse {
  access_token:  string;
  refresh_token?: string;
  expires_in:    number;
  token_type:    string;
  scope:         string;
}

// Google userinfo response
export interface GoogleUserInfo {
  id:             string;
  email:          string;
  name:           string;
  picture:        string;
  verified_email: boolean;
}

// Payload passed to GoogleCalendarSyncService
export interface SyncBookingPayload {
  bookingId:        string;
  calendarId:       string;
  calendarName:     string;
  userId:           string;
  visitorName:      string;
  visitorEmail:     string;
  visitorPhone:     string | null;
  visitorNotes:     string | null;
  startsAt:         string;  // ISO UTC
  endsAt:           string;  // ISO UTC
  timezone:         string;
  meetingUrl:       string | null;
  location:         string | null;
  customFormResponses: Record<string, unknown>;
  correlationId:    string | null;
}
