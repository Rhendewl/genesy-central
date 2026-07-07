import type { Db } from "./types";

export { renderTemplate as renderWorkflowTemplate } from "@/lib/notifications/push-dispatcher";

export interface WorkflowVariableSource {
  leadId: string;
  extra?: Record<string, string>;
}

/**
 * Resolve todas as variáveis {{var}} suportadas pelo motor de automação a
 * partir de um lead. Ponto único de extensão: uma variável nova = uma chave
 * nova neste objeto, sem mudar nenhum outro lugar (templates continuam
 * texto livre, resolvidos por src/lib/notifications/push-dispatcher.ts).
 */
export async function resolveWorkflowVariables(
  db: Db,
  source: WorkflowVariableSource,
): Promise<Record<string, string>> {
  const { leadId, extra } = source;

  const { data: lead } = await db
    .from("leads")
    .select("name, email, contact, iq_score, ie_score, entered_at, pipeline_id, stage_id, assigned_to")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) return { ...extra };

  const [pipelineRes, stageRes, assigneeRes, historyRes] = await Promise.all([
    lead.pipeline_id
      ? db.from("crm_pipelines").select("name, user_id").eq("id", lead.pipeline_id).maybeSingle()
      : Promise.resolve({ data: null }),
    lead.stage_id
      ? db.from("crm_stages").select("name").eq("id", lead.stage_id).maybeSingle()
      : Promise.resolve({ data: null }),
    lead.assigned_to
      ? db.from("user_profiles").select("full_name").eq("id", lead.assigned_to).maybeSingle()
      : Promise.resolve({ data: null }),
    lead.stage_id
      ? db.from("crm_lead_stage_history")
          .select("moved_at")
          .eq("lead_id", leadId)
          .eq("stage_id", lead.stage_id)
          .order("moved_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const pipeline = pipelineRes.data as { name?: string; user_id?: string } | null;
  const stage    = stageRes.data as { name?: string } | null;
  const assignee = assigneeRes.data as { full_name?: string } | null;
  const history  = historyRes.data as { moved_at?: string } | null;

  // company_profile é por dono de conta (auth.users.id), não por lead —
  // resolvido via pipeline.user_id.
  let companyName = "";
  if (pipeline?.user_id) {
    const { data: company } = await db
      .from("company_profile")
      .select("company_name")
      .eq("user_id", pipeline.user_id)
      .maybeSingle();
    companyName = company?.company_name ?? "";
  }

  // dias_na_etapa: última entrada nessa etapa (histórico), com fallback pra
  // entered_at do lead se ainda não há linha de histórico (lead recém-criado
  // já direto na etapa atual).
  const movedAtStr = history?.moved_at ?? lead.entered_at;
  const diasNaEtapa = movedAtStr
    ? Math.max(0, Math.floor((Date.now() - new Date(movedAtStr).getTime()) / 86_400_000))
    : 0;

  const now = new Date();

  return {
    "lead.nome":      lead.name ?? "",
    "lead.email":     lead.email ?? "",
    "lead.telefone":  lead.contact ?? "",
    "pipeline.nome":  pipeline?.name ?? "",
    "etapa.nome":     stage?.name ?? "",
    "responsavel.nome": assignee?.full_name ?? "",
    "empresa":        companyName,
    "data":           now.toLocaleDateString("pt-BR"),
    "hora":           now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    "iq":             lead.iq_score != null ? String(lead.iq_score) : "",
    "ie":             lead.ie_score != null ? String(lead.ie_score) : "",
    "dias_na_etapa":  String(diasNaEtapa),
    ...extra,
  };
}
