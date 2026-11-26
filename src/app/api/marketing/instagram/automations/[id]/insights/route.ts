import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { apiError, getMarketingServerContext } from "@/lib/marketing/server";
import { assertMarketingAccess, scopeByConnectionIds, visibleInstagramConnectionIds } from "@/lib/marketing/instagram-access";
import { loadAutomationInsights } from "@/lib/instagram-automation/insights";

export const dynamic = "force-dynamic";

const PERIODS = new Set([7, 30, 90]);

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient();
  try {
    const context = await getMarketingServerContext(supabase);
    assertMarketingAccess(context, "marketing.instagram.automations");
    const visibleIds = await visibleInstagramConnectionIds(supabase, context);
    const requested = Number(new URL(req.url).searchParams.get("days") ?? 30);
    const days = PERIODS.has(requested) ? requested : 30;
    const { data: automation, error } = await scopeByConnectionIds(supabase.from("marketing_instagram_automations")
      .select("id,connection_id,trigger_type,steps,flow,crm_enabled,crm_pipeline_id,crm_stage_id")
      .eq("id", params.id).eq("organization_id", context.organizationId), visibleIds).maybeSingle();
    if (error) throw new Error(error.message);
    if (!automation) throw Object.assign(new Error("Automação não encontrada"), { status: 404 });
    const insights = await loadAutomationInsights(supabase, automation, days);
    return NextResponse.json({ insights }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const parsed = apiError(error);
    return NextResponse.json({ error: parsed.message }, { status: parsed.status });
  }
}
