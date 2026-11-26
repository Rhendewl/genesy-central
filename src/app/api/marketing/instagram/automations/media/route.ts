import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { apiError, getMarketingServerContext } from "@/lib/marketing/server";
import { assertMarketingAccess, scopeInstagramConnections } from "@/lib/marketing/instagram-access";
import { decryptToken } from "@/lib/crypto";
import { getInstagramMediaByIds, getInstagramMediaPage } from "@/lib/instagram-api";
import { toAutomationPost } from "@/lib/instagram-automation/posts";
import { MAX_AUTOMATION_POSTS, sanitizeMediaIds } from "@/lib/instagram-automation/validation";

export const dynamic = "force-dynamic";

/**
 * Posts of a connected account for the automation post picker.
 * `?connectionId=&after=` pages the feed; `?connectionId=&ids=a,b` refreshes chosen posts.
 * Thumbnails come straight from Instagram because CDN links expire.
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  try {
    const context = await getMarketingServerContext(supabase);
    assertMarketingAccess(context, "marketing.instagram.automations");
    const params = new URL(req.url).searchParams;
    const connectionId = params.get("connectionId") ?? "";
    if (!connectionId) throw Object.assign(new Error("Escolha a conta do Instagram"), { status: 400 });
    const { data: connection } = await scopeInstagramConnections(supabase.from("marketing_instagram_connections")
      .select("id,status,encrypted_access_token,token_expires_at")
      .eq("id", connectionId).eq("organization_id", context.organizationId), context).maybeSingle();
    if (!connection) throw Object.assign(new Error("Conta do Instagram não encontrada"), { status: 404 });
    if (connection.status === "disconnected" || !connection.encrypted_access_token
      || (connection.token_expires_at && Date.parse(connection.token_expires_at) <= Date.now())) {
      throw Object.assign(new Error("Reconecte a conta do Instagram para carregar os posts"), { status: 409 });
    }
    const token = decryptToken(connection.encrypted_access_token);
    const headers = { "Cache-Control": "private, max-age=120" };
    if (params.has("ids")) {
      const ids = sanitizeMediaIds((params.get("ids") ?? "").split(",")).slice(0, MAX_AUTOMATION_POSTS);
      const media = ids.length ? await getInstagramMediaByIds(token, ids) : [];
      return NextResponse.json({ posts: media.map(toAutomationPost), after: null }, { headers });
    }
    const page = await getInstagramMediaPage(token, params.get("after"));
    return NextResponse.json({ posts: page.media.map(toAutomationPost), after: page.after }, { headers });
  } catch (error) {
    const parsed = apiError(error);
    return NextResponse.json({ error: parsed.message }, { status: parsed.status });
  }
}
