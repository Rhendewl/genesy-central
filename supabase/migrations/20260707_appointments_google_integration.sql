-- ── Sprint 1: Google Calendar Integration ─────────────────────────────────────
-- Adds missing columns to appointment_google_connections (table created in
-- 20260703_appointments_module.sql) and configures RLS for the new API routes.
--
-- NOTE: access_token and refresh_token columns store AES-256-GCM encrypted
-- values (via src/lib/crypto.ts encryptToken). Column names kept as-is for
-- backwards compatibility.

-- ── 1. Add missing UI/control columns ────────────────────────────────────────

ALTER TABLE appointment_google_connections
  ADD COLUMN IF NOT EXISTS google_account_name    text,
  ADD COLUMN IF NOT EXISTS google_account_picture text,
  ADD COLUMN IF NOT EXISTS auto_create_events     boolean     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_sync_status       text        NOT NULL DEFAULT 'idle'
    CONSTRAINT google_conn_sync_status_chk
    CHECK (last_sync_status IN ('idle', 'syncing', 'success', 'error'));

-- ── 2. RLS policies for appointment_google_connections ────────────────────────
-- (Table and ENABLE ROW LEVEL SECURITY already done in 20260703 migration)

DROP POLICY IF EXISTS "google_connections_select" ON appointment_google_connections;
CREATE POLICY "google_connections_select"
  ON appointment_google_connections FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "google_connections_insert" ON appointment_google_connections;
CREATE POLICY "google_connections_insert"
  ON appointment_google_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "google_connections_update" ON appointment_google_connections;
CREATE POLICY "google_connections_update"
  ON appointment_google_connections FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "google_connections_delete" ON appointment_google_connections;
CREATE POLICY "google_connections_delete"
  ON appointment_google_connections FOR DELETE
  USING (auth.uid() = user_id);

-- ── 3. Index on user_id for quick connection lookup ───────────────────────────
CREATE INDEX IF NOT EXISTS google_connections_user_id_idx
  ON appointment_google_connections (user_id);
