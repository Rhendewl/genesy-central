import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  GoogleCalendarConnectionRow,
  GoogleCalendarConnection,
  GoogleSyncStatus,
} from "@/types/google-calendar";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export class GoogleConnectionRepository {
  constructor(private readonly db: Db) {}

  // Returns the full row including encrypted tokens (server-only use)
  async findByUserId(userId: string): Promise<GoogleCalendarConnectionRow | null> {
    const { data, error } = await this.db
      .from("appointment_google_connections")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as GoogleCalendarConnectionRow | null;
  }

  // Returns public-safe shape (no encrypted token fields)
  async getStatusForUser(userId: string): Promise<GoogleCalendarConnection | null> {
    const { data, error } = await this.db
      .from("appointment_google_connections")
      .select(
        "id,user_id,google_account_email,google_account_name,google_account_picture," +
        "token_expires_at,scopes,is_active,auto_create_events," +
        "last_sync_at,last_sync_status,last_error,created_at,updated_at"
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as GoogleCalendarConnection | null;
  }

  async upsert(row: {
    user_id:                string;
    google_account_email:   string;
    google_account_name:    string | null;
    google_account_picture: string | null;
    access_token:           string;  // encrypted
    refresh_token:          string;  // encrypted
    token_expires_at:       string | null;
    scopes:                 string[];
    is_active:              boolean;
  }): Promise<void> {
    const { error } = await this.db
      .from("appointment_google_connections")
      .upsert(
        { ...row, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    if (error) throw new Error(error.message);
  }

  async updateTokens(
    userId: string,
    accessToken: string,   // encrypted
    expiresAt:   string | null,
  ): Promise<void> {
    const { error } = await this.db
      .from("appointment_google_connections")
      .update({ access_token: accessToken, token_expires_at: expiresAt, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
  }

  async updateAutoCreateEvents(userId: string, value: boolean): Promise<void> {
    const { error } = await this.db
      .from("appointment_google_connections")
      .update({ auto_create_events: value, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
  }

  async updateSyncStatus(
    userId:    string,
    status:    GoogleSyncStatus,
    syncedAt:  string | null,
    lastError: string | null,
  ): Promise<void> {
    const patch: Record<string, unknown> = {
      last_sync_status: status,
      updated_at: new Date().toISOString(),
    };
    if (syncedAt !== undefined)  patch.last_sync_at = syncedAt;
    if (lastError !== undefined) patch.last_error   = lastError;
    const { error } = await this.db
      .from("appointment_google_connections")
      .update(patch)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
  }

  async delete(userId: string): Promise<void> {
    const { error } = await this.db
      .from("appointment_google_connections")
      .delete()
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
  }
}
