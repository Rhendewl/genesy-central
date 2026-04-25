import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { verifyOAuthState, encryptToken } from "@/lib/crypto";
import { exchangeCodeForToken, getAdAccounts } from "@/lib/meta-api";

type OAuthState = Record<string, unknown> & {
  tokenId:  string;
  clientId: string | null;
  returnTo: string | null;
  nonce:    string;
  ts:       number;
};

// GET /api/meta/callback?code=xxx&state=xxx
// Meta redirects here after the user approves the app.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const errorUrl = `${origin}/trafego?tab=integracoes&meta_error=1`;

  try {
    const code       = req.nextUrl.searchParams.get("code");
    const stateParam = req.nextUrl.searchParams.get("state");
    const denied     = req.nextUrl.searchParams.get("error");

    if (denied || !code || !stateParam) {
      return NextResponse.redirect(errorUrl);
    }

    const { tokenId, clientId, returnTo } = verifyOAuthState<OAuthState>(stateParam);
    // Only allow same-origin paths to prevent open redirect
    const safeReturn = (returnTo && /^\/[a-zA-Z]/.test(returnTo)) ? returnTo : "/trafego";
    const redirectUri = `${origin}/api/meta/callback`;

    const { access_token, expires_in } = await exchangeCodeForToken(code, redirectUri);
    const adAccounts = await getAdAccounts(access_token);
    const encrypted  = encryptToken(access_token);
    const expiresAt  = expires_in
      ? new Date(Date.now() + expires_in * 1000).toISOString()
      : null;

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("meta_tokens")
      .update({
        encrypted_token:  encrypted,
        token_expires_at: expiresAt,
        ad_accounts:      adAccounts,
      })
      .eq("id", tokenId);

    if (error) throw error;

    const params = new URLSearchParams({ tab: "integracoes", meta_pending: tokenId });
    if (clientId) params.set("meta_client", clientId);

    return NextResponse.redirect(`${origin}${safeReturn}?${params}`);
  } catch (err) {
    console.error("[meta/callback]", err);
    return NextResponse.redirect(errorUrl);
  }
}
