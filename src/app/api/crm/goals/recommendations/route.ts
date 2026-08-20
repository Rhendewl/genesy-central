import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { CRM_GOAL_BENCHMARKS } from "@/lib/crm/goal-calculator";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const pipelineId = req.nextUrl.searchParams.get("pipeline_id");
  let stagesQuery = supabase.from("crm_stages").select("id").eq("metric_type", "sale");
  if (pipelineId) stagesQuery = stagesQuery.eq("pipeline_id", pipelineId);
  const { data: saleStages, error: stagesError } = await stagesQuery;
  if (stagesError) return NextResponse.json({ error: stagesError.message }, { status: 500 });

  const stageIds = (saleStages ?? []).map((stage) => stage.id);
  let averageTicket: number | null = null;
  let salesSample = 0;

  if (stageIds.length > 0) {
    const { data: history, error: historyError } = await supabase
      .from("crm_lead_stage_history")
      .select("lead_id")
      .in("stage_id", stageIds);
    if (historyError) return NextResponse.json({ error: historyError.message }, { status: 500 });

    const leadIds = Array.from(new Set((history ?? []).map((row) => row.lead_id)));
    if (leadIds.length > 0) {
      let leadsQuery = supabase.from("leads").select("deal_value,pipeline_id").in("id", leadIds).gt("deal_value", 0);
      if (pipelineId) leadsQuery = leadsQuery.eq("pipeline_id", pipelineId);
      const { data: wonLeads, error: leadsError } = await leadsQuery;
      if (leadsError) return NextResponse.json({ error: leadsError.message }, { status: 500 });
      const values = (wonLeads ?? []).map((lead) => Number(lead.deal_value)).filter((value) => Number.isFinite(value) && value > 0);
      salesSample = values.length;
      if (values.length > 0) averageTicket = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    }
  }

  return NextResponse.json({ averageTicket, salesSample, benchmarks: CRM_GOAL_BENCHMARKS });
}
