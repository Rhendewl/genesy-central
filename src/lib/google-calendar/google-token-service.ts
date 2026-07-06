// ── GoogleTokenService ────────────────────────────────────────────────────────
// Manages token lifecycle:
//   - Encrypt / decrypt tokens stored in DB
//   - Detect expiry and refresh automatically
//   - Update DB after refresh
//
// All callers receive a valid, decrypted access_token or an error.

import { encryptToken, decryptToken } from "@/lib/crypto";
import { refreshAccessToken }          from "./google-oauth-service";
import { GoogleConnectionRepository }  from "./google-connection-repository";
import { GoogleAuthError }             from "./google-calendar-service";
import type { SupabaseClient }         from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

// Buffer: refresh 5 minutes before actual expiry to avoid edge-case failures
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

export class GoogleTokenService {
  private readonly repo: GoogleConnectionRepository;

  constructor(db: Db) {
    this.repo = new GoogleConnectionRepository(db);
  }

  encryptToken(plain: string): string {
    return encryptToken(plain);
  }

  decryptToken(encrypted: string): string {
    return decryptToken(encrypted);
  }

  // Returns a valid access token, refreshing automatically if expired.
  // Throws if no connection exists or refresh fails.
  async getValidAccessToken(userId: string): Promise<string> {
    const row = await this.repo.findByUserId(userId);
    if (!row || !row.is_active) {
      throw new GoogleAuthError("Google Calendar not connected");
    }

    const isExpired =
      !row.token_expires_at ||
      new Date(row.token_expires_at).getTime() - EXPIRY_BUFFER_MS < Date.now();

    if (!isExpired) {
      return decryptToken(row.access_token);
    }

    // Token expired — refresh
    const plainRefresh = decryptToken(row.refresh_token);
    let refreshed: { access_token: string; expires_at: string };
    try {
      refreshed = await refreshAccessToken(plainRefresh);
    } catch (err) {
      // Refresh token itself revoked/invalid — same "needs reconnect" state as no connection
      throw new GoogleAuthError(err instanceof Error ? err.message : "Google Calendar refresh failed");
    }

    const encryptedNew = encryptToken(refreshed.access_token);
    await this.repo.updateTokens(userId, encryptedNew, refreshed.expires_at);

    return refreshed.access_token;
  }
}
