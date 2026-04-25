import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { signOAuthState } from "@/lib/crypto";
import { randomBytes } from "crypto";

// GET /api/meta/auth?clientId=xxx
// Initiates Meta OAuth. Redirects to Facebook login page.
export async function GET(req: NextRequest) {
  try {
    const appId = process.env.META_APP_ID ?? process.env.NEXT_PUBLIC_META_APP_ID;
    if (!appId) {
      return NextResponse.json({ error: "META_APP_ID não configurado" }, { status: 500 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const clientId  = req.nextUrl.searchParams.get("clientId")   ?? null;
    const returnTo  = req.nextUrl.searchParams.get("return_to")  ?? null;

    // Create a pending meta_tokens row to anchor the state
    const { data: tokenRow, error } = await supabase
      .from("meta_tokens")
      .insert({ user_id: user.id })
      .select("id")
      .single();
    if (error) throw error;

    const state = signOAuthState({
      tokenId: tokenRow.id,
      clientId,
      returnTo,
      nonce: randomBytes(8).toString("hex"),
    });

    const redirectUri = `${req.nextUrl.origin}/api/meta/callback`;
    const oauthUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    oauthUrl.searchParams.set("client_id", appId);
    oauthUrl.searchParams.set("redirect_uri", redirectUri);
    oauthUrl.searchParams.set("scope", "ads_read,ads_management,business_management,leads_retrieval,pages_show_list,pages_read_engagement,pages_manage_ads");
    oauthUrl.searchParams.set("response_type", "code");
    oauthUrl.searchParams.set("state", state);

    return NextResponse.redirect(oauthUrl.toString());
  } catch (err) {
    console.error("[meta/auth]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
