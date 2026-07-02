-- Add browser tracking signals to form_sessions.
--
-- These fields are captured once, at session creation, from the visitor's
-- browser and HTTP headers. They remain here and are loaded on demand by
-- the Conversion Engine via EventContext — no duplication into leads.
--
-- fbp             → _fbp cookie (Meta Browser ID, set by Pixel)
-- fbc             → _fbc cookie (Meta Click ID, derived from fbclid)
-- user_agent      → raw User-Agent header (used for client_user_agent in CAPI)
-- event_source_url → full URL at the moment the session was created
--                   (used as event_source_url in Meta CAPI and equivalents)

ALTER TABLE form_sessions
  ADD COLUMN IF NOT EXISTS fbp              TEXT,
  ADD COLUMN IF NOT EXISTS fbc              TEXT,
  ADD COLUMN IF NOT EXISTS user_agent       TEXT,
  ADD COLUMN IF NOT EXISTS event_source_url TEXT;
