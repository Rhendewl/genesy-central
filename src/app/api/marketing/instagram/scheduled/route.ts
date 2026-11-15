import { syncInstagramEditorial } from "@/lib/marketing/editorial-instagram";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { apiError, getMarketingServerContext } from "@/lib/marketing/server";

export const dynamic = "force-dynamic";
async function context() {
  const ctx = await getMarketingServerContext(await createServerSupabaseClient());
  if (!ctx.isAdmin) throw Object.assign(new Error("Apenas administradores podem gerenciar publicações."), { status: 403 });
  return { ctx, db: createAdminSupabaseClient() };
}
export async function GET() {
  try {
    const { ctx, db } = await context();
    const { data, error } = await db.from("marketing_instagram_scheduled_posts")
      .select("id,connection_id,scheduled_at,caption,status,last_error,published_at")
      .eq("organization_id", ctx.organizationId).order("scheduled_at", { ascending: false }).limit(30);
    if (error) throw error;
    return NextResponse.json({ posts: data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { const e = apiError(error); return NextResponse.json({ error: e.message }, { status: e.status }); }
}
export async function DELETE(req: NextRequest) {
  try {
    const { ctx, db } = await context();
    const { id } = await req.json();
    const { data, error } = await db.from("marketing_instagram_scheduled_posts").update({ status: "cancelled" })
      .eq("id", id).eq("organization_id", ctx.organizationId).eq("status", "scheduled").is("locked_until", null).select("paths,preview_path").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "O post já está em processamento ou não está disponível para cancelamento." }, { status: 409 });
    await syncInstagramEditorial(db, ctx.organizationId, id).catch(() => console.error("Instagram editorial cancellation sync pending", id));
    await db.storage.from("criativos").remove([...data.paths, ...(data.preview_path ? [data.preview_path] : [])]);
    return NextResponse.json({ cancelled: true });
  } catch (error) { const e = apiError(error); return NextResponse.json({ error: e.message }, { status: e.status }); }
}
