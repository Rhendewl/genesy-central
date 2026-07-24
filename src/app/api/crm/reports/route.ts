import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { CrmActivity, CrmReportBreakdown, CrmReportResponse } from "@/types/crm-reports";

type RawActivity = Omit<CrmActivity, "actor_name" | "assignee_name" | "pipeline_name">;

function validDate(value: string | null): value is string {
  return !!value && !Number.isNaN(new Date(value).getTime());
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const pipelineId = req.nextUrl.searchParams.get("pipeline_id");
  const assigneeId = req.nextUrl.searchParams.get("assignee_id");
  if (!validDate(from) || !validDate(to) || new Date(from) > new Date(to)) {
    return NextResponse.json({ error: "Período inválido" }, { status: 400 });
  }

  let query = supabase.from("crm_activity_log").select(
    "id,lead_id,pipeline_id,stage_id,actor_user_id,assigned_to,event_type,lead_name,lead_contact,source,deal_value,from_stage_name,to_stage_name,note_content,metadata,occurred_at"
  ).gte("occurred_at", from).lte("occurred_at", to).order("occurred_at", { ascending: false }).limit(10000);
  if (pipelineId) query = query.eq("pipeline_id", pipelineId);
  if (assigneeId) query = query.eq("assigned_to", assigneeId);

  const [activityResult, pipelinesResult, profilesResult, leadsResult] = await Promise.all([
    query,
    supabase.from("crm_pipelines").select("id,name").order("order_index"),
    supabase.from("user_profiles").select("id,auth_user_id,full_name").eq("is_active", true).order("full_name"),
    supabase.from("leads").select("id,canonical_lead_id"),
  ]);
  if (activityResult.error) return NextResponse.json({ error: activityResult.error.message }, { status: 500 });

  const pipelines = (pipelinesResult.data ?? []) as { id: string; name: string }[];
  const profiles = (profilesResult.data ?? []) as { id: string; auth_user_id: string | null; full_name: string }[];
  const pipelineNames = new Map(pipelines.map(item => [item.id, item.name]));
  const profileNames = new Map(profiles.map(item => [item.id, item.full_name]));
  const actorNames = new Map(profiles.filter(item => item.auth_user_id).map(item => [item.auth_user_id!, item.full_name]));
  const canonicalIds = new Map(
    ((leadsResult.data ?? []) as { id: string; canonical_lead_id?: string | null }[])
      .map(item => [item.id, item.canonical_lead_id ?? item.id]),
  );
  const leadIdentity = (leadId: string | null) => leadId ? canonicalIds.get(leadId) ?? leadId : null;
  const activities: CrmActivity[] = ((activityResult.data ?? []) as RawActivity[]).map(item => ({
    ...item,
    deal_value: Number(item.deal_value ?? 0),
    actor_name: item.actor_user_id ? actorNames.get(item.actor_user_id) ?? "Usuário" : "Sistema/integração",
    assignee_name: item.assigned_to ? profileNames.get(item.assigned_to) ?? "Responsável removido" : "Sem responsável",
    pipeline_name: item.pipeline_id ? pipelineNames.get(item.pipeline_id) ?? "Pipeline removida" : "Sem pipeline",
  }));

  const created = activities.filter(item => item.event_type === "lead_created");
  const won = activities.filter(item => item.event_type === "deal_won");
  const lost = activities.filter(item => item.event_type === "deal_lost");
  const movements = activities.filter(item => ["stage_changed", "deal_won", "deal_lost"].includes(item.event_type));
  const workedIds = new Set(
    activities
      .filter(item => item.event_type !== "lead_created")
      .map(item => leadIdentity(item.lead_id))
      .filter((id): id is string => Boolean(id)),
  );
  const wonValue = won.reduce((sum, item) => sum + item.deal_value, 0);

  function breakdown(items: CrmActivity[], keyOf: (item: CrmActivity) => string, labelOf: (item: CrmActivity) => string): CrmReportBreakdown[] {
    const map = new Map<string, CrmReportBreakdown & { leadIds: Set<string> }>();
    for (const item of items) {
      const id = keyOf(item) || "unknown";
      const current = map.get(id) ?? { id, label: labelOf(item), activities: 0, leads: 0, wins: 0, value: 0, leadIds: new Set<string>() };
      current.activities += 1;
      const identity = leadIdentity(item.lead_id);
      if (identity) current.leadIds.add(identity);
      if (item.event_type === "deal_won") { current.wins += 1; current.value += item.deal_value; }
      map.set(id, current);
    }
    return Array.from(map.values()).map(({ leadIds, ...item }) => ({ ...item, leads: leadIds.size })).sort((a, b) => b.activities - a.activities);
  }

  const response: CrmReportResponse = {
    period: { from, to },
    summary: {
      totalActivities: activities.length,
      leadsCreated: created.length,
      leadsWorked: workedIds.size,
      stageMovements: movements.length,
      dealsWon: won.length,
      dealsLost: lost.length,
      wonValue,
      averageTicket: won.length ? wonValue / won.length : 0,
      conversionRate: created.length ? (won.length / created.length) * 100 : 0,
      notesAdded: activities.filter(item => ["note_added", "note_updated", "stage_note"].includes(item.event_type)).length,
    },
    activities,
    byStage: breakdown(movements, item => item.stage_id ?? item.to_stage_name ?? "unknown", item => item.to_stage_name ?? "Sem etapa"),
    byAssignee: breakdown(activities, item => item.assigned_to ?? "unassigned", item => item.assignee_name),
    bySource: breakdown(activities, item => item.source ?? "unknown", item => item.source || "Não informada"),
    options: {
      pipelines,
      assignees: profiles.map(item => ({ id: item.id, name: item.full_name })),
    },
  };
  return NextResponse.json(response);
}
