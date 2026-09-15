import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { apiError, getMarketingServerContext } from "@/lib/marketing/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const db = await createServerSupabaseClient();
  try {
    await getMarketingServerContext(db);
    const { id } = await params;
    const body = await req.json() as { status?: "active" | "paused" };
    if (!body.status || !["active", "paused"].includes(body.status)) throw Object.assign(new Error("Status inválido"), { status: 400 });
    const { error } = await db.from("marketing_vgv_forms").update({ status: body.status }).eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (error) { const parsed = apiError(error); return NextResponse.json({ error: parsed.message }, { status: parsed.status }); }
}
