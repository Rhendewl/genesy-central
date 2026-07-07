import type { ConditionResolver, ConditionEvalContext } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Condições de CRM (Fase 1). Cada uma compara o ESTADO ATUAL do lead contra o
// que foi capturado em trigger_snapshot no momento do gatilho — é assim que
// "ainda estiver na mesma etapa" sabe contra o que comparar.
//
// Novas condições futuras (IQ/IE, tag, origem, campanha, formulário) são só
// mais entradas neste array — zero mudança no motor.
// ─────────────────────────────────────────────────────────────────────────────

async function getLead(ctx: ConditionEvalContext) {
  const { data } = await ctx.db
    .from("leads")
    .select("stage_id, assigned_to")
    .eq("id", ctx.recordId)
    .maybeSingle();
  return data as { stage_id: string | null; assigned_to: string | null } | null;
}

const sameStage: ConditionResolver = {
  type: "crm.lead.same_stage",
  async evaluate(ctx) {
    const lead = await getLead(ctx);
    if (!lead) return false;
    return lead.stage_id === (ctx.triggerSnapshot.stageId ?? null);
  },
};

const sameOwner: ConditionResolver = {
  type: "crm.lead.same_owner",
  async evaluate(ctx) {
    const lead = await getLead(ctx);
    if (!lead) return false;
    return lead.assigned_to === (ctx.triggerSnapshot.assignedTo ?? null);
  },
};

async function currentStageFlags(ctx: ConditionEvalContext): Promise<{ is_won: boolean; is_lost: boolean } | null> {
  const lead = await getLead(ctx);
  if (!lead?.stage_id) return null;
  const { data: stage } = await ctx.db.from("crm_stages").select("is_won, is_lost").eq("id", lead.stage_id).maybeSingle();
  return (stage as { is_won: boolean; is_lost: boolean } | null) ?? null;
}

const notWon: ConditionResolver = {
  type: "crm.lead.not_won",
  async evaluate(ctx) {
    const flags = await currentStageFlags(ctx);
    return !flags?.is_won;
  },
};

const notLost: ConditionResolver = {
  type: "crm.lead.not_lost",
  async evaluate(ctx) {
    const flags = await currentStageFlags(ctx);
    return !flags?.is_lost;
  },
};

export const crmConditionResolvers: ConditionResolver[] = [sameStage, sameOwner, notWon, notLost];
