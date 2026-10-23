import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { getMarketingServerContext, apiError } from "@/lib/marketing/server";
import { processMetaLeadEvent } from "@/lib/meta-lead-capture";
export const maxDuration = 60;
export async function POST(req: NextRequest) {
  try {
    const db = await createServerSupabaseClient();
    const context = await getMarketingServerContext(db);
    if (!context.isAdmin) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    const { id } = await req.json();
    const { data: log, error } = await db.from("meta_webhook_logs").select("payload,status")
      .eq("id", id).eq("user_id", context.user.id).maybeSingle();
    if (error || !log || !["error", "received"].includes(log.status)) return NextResponse.json({ error: "Evento não disponível para reprocessamento." }, { status: 400 });
    const event = log.payload;
    if (![event?.page_id, event?.leadgen_id, event?.form_id].every((value) => typeof value === "string" && /^\d+$/.test(value))) return NextResponse.json({ error: "Evento inválido." }, { status: 400 });
    const result = await processMetaLeadEvent(createAdminSupabaseClient(), event, context.user.id);
    return NextResponse.json(result);
  } catch (error) { const e = apiError(error); return NextResponse.json({ error: e.message }, { status: e.status }); }
}
