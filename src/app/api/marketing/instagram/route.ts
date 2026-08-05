import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { apiError, getMarketingServerContext } from "@/lib/marketing/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  try {
    const context = await getMarketingServerContext(supabase);
    const start = req.nextUrl.searchParams.get("start");
    const end = req.nextUrl.searchParams.get("end");
    const [connections, media] = await Promise.all([
      supabase
        .from("marketing_instagram_connections")
        .select("id,instagram_user_id,username,display_name,profile_picture_url,followers_count,media_count,status,last_sync_at,sync_error,token_expires_at,created_at")
        .eq("organization_id", context.organizationId)
        .order("created_at"),
      (() => {
        let query = supabase
          .from("marketing_instagram_media")
          .select("id,connection_id,marketing_content_id,instagram_media_id,media_type,media_product_type,caption,media_url,thumbnail_url,permalink,published_at,reach,views,plays,likes,comments,saved,shares,total_interactions,average_watch_time,total_watch_time,last_synced_at")
          .eq("organization_id", context.organizationId)
          .order("published_at", { ascending: false });
        if (start) query = query.gte("published_at", `${start}T00:00:00`);
        if (end) query = query.lte("published_at", `${end}T23:59:59.999`);
        return query.limit(250);
      })(),
    ]);
    if (connections.error) throw new Error(connections.error.message);
    if (media.error) throw new Error(media.error.message);
    return NextResponse.json({ connections: connections.data ?? [], media: media.data ?? [], is_admin: context.isAdmin });
  } catch (error) {
    const parsed = apiError(error);
    return NextResponse.json({ error: parsed.message }, { status: parsed.status });
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  try {
    const context = await getMarketingServerContext(supabase);
    if (!context.isAdmin) throw Object.assign(new Error("Apenas administradores podem desconectar contas"), { status: 403 });
    const body = await req.json().catch(() => ({})) as { connectionId?: string };
    if (!body.connectionId) throw Object.assign(new Error("Conta não informada"), { status: 400 });
    const { error } = await supabase
      .from("marketing_instagram_connections")
      .delete()
      .eq("id", body.connectionId)
      .eq("organization_id", context.organizationId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (error) {
    const parsed = apiError(error);
    return NextResponse.json({ error: parsed.message }, { status: parsed.status });
  }
}
