import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { signState } from "@/lib/crypto";
import { apiError, getMarketingServerContext } from "@/lib/marketing/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  try {
    const context = await getMarketingServerContext(supabase);
    if (!context.isAdmin) throw Object.assign(new Error("Apenas administradores podem conectar uma conta"), { status: 403 });
    const clientId = process.env.INSTAGRAM_APP_ID ?? process.env.META_APP_ID;
    if (!clientId) throw new Error("INSTAGRAM_APP_ID não configurado");

    const redirectUri = `${req.nextUrl.origin}/api/marketing/instagram/callback`;
    const state = signState({
      userId: context.user.id,
      organizationId: context.organizationId,
      nonce: randomBytes(12).toString("hex"),
    });
    const oauth = new URL("https://www.instagram.com/oauth/authorize");
    oauth.searchParams.set("client_id", clientId);
    oauth.searchParams.set("redirect_uri", redirectUri);
    oauth.searchParams.set("response_type", "code");
    oauth.searchParams.set("scope", "instagram_business_basic,instagram_business_manage_insights");
    oauth.searchParams.set("enable_fb_login", "0");
    oauth.searchParams.set("force_authentication", "1");
    oauth.searchParams.set("state", state);
    return NextResponse.redirect(oauth.toString());
  } catch (error) {
    const parsed = apiError(error);
    return NextResponse.json({ error: parsed.message }, { status: parsed.status });
  }
}
