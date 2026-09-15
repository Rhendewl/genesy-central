import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { apiError, getMarketingServerContext } from "@/lib/marketing/server";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const db = await createServerSupabaseClient();
  try { await getMarketingServerContext(db); const { id } = await params; const { error } = await db.from("marketing_vgv_campaign_performance").delete().eq("id", id); if (error) throw new Error(error.message); return NextResponse.json({ success: true }); }
  catch (error) { const parsed = apiError(error); return NextResponse.json({ error: parsed.message }, { status: parsed.status }); }
}
