// GET /api/google-calendar/callback?code=xxx&state=xxx
// Public route (Google redirects here — no session cookie available).
// Auth is derived from the signed state parameter.

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient }  from "@/lib/supabase-admin";
import { verifyState, encryptToken }  from "@/lib/crypto";
import {
  exchangeCodeForTokens,
  fetchUserInfo,
}                                     from "@/lib/google-calendar/google-oauth-service";
import { GoogleConnectionRepository } from "@/lib/google-calendar/google-connection-repository";

type OAuthState = { userId: string; returnTo: string; ts: number };

export async function GET(req: NextRequest) {
  const origin   = req.nextUrl.origin;
  const errorUrl = `${origin}/agendamentos?tab=integracoes&google_error=1`;

  try {
    const code     = req.nextUrl.searchParams.get("code");
    const stateRaw = req.nextUrl.searchParams.get("state");
    const denied   = req.nextUrl.searchParams.get("error");

    if (denied || !code || !stateRaw) {
      console.warn("[google/callback] Access denied or missing params:", { denied, code: !!code });
      return NextResponse.redirect(errorUrl);
    }

    // Verify signed state — extracts userId without needing a session cookie
    const { userId, returnTo } = verifyState<OAuthState>(stateRaw);
    const safeReturn = /^\/[a-zA-Z]/.test(returnTo ?? "") ? returnTo : "/agendamentos";

    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.refresh_token) {
      // This can happen if prompt=consent was not used or the user already authorized
      // Redirect with a specific error so the UI can instruct the user to re-authorize
      console.error("[google/callback] No refresh_token in response — consent may have been skipped");
      return NextResponse.redirect(`${origin}/agendamentos?tab=integracoes&google_error=no_refresh_token`);
    }

    // Fetch Google account info
    const userInfo = await fetchUserInfo(tokens.access_token);

    // Encrypt sensitive tokens before storing
    const encryptedAccess  = encryptToken(tokens.access_token);
    const encryptedRefresh = encryptToken(tokens.refresh_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Upsert connection (service role — bypasses RLS since we verified state)
    const db   = createAdminSupabaseClient();
    const repo = new GoogleConnectionRepository(db);
    await repo.upsert({
      user_id:                userId,
      google_account_email:   userInfo.email,
      google_account_name:    userInfo.name   ?? null,
      google_account_picture: userInfo.picture ?? null,
      access_token:           encryptedAccess,
      refresh_token:          encryptedRefresh,
      token_expires_at:       expiresAt,
      scopes:                 tokens.scope.split(" "),
      is_active:              true,
    });

    console.info(`[google/callback] Connected for user ${userId} (${userInfo.email})`);
    return NextResponse.redirect(
      `${origin}${safeReturn}?tab=integracoes&google_connected=1`
    );
  } catch (err) {
    console.error("[google/callback] Error:", err);
    return NextResponse.redirect(errorUrl);
  }
}
