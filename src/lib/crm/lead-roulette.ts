import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlatformEventBus } from "@/lib/event-bus/platform";

export interface RouletteResult {
  matched: boolean;
  status?: "distributed" | "duplicate" | "pending";
  lead_id?: string | null;
  pipeline_id?: string;
  stage_id?: string;
}

export async function distributeFormLead(db: SupabaseClient, input: {
  ownerId: string; source: "genesy" | "meta"; formId: string; pageId?: string;
  eventId: string; payload: Record<string, unknown> | null;
}): Promise<RouletteResult> {
  const { data, error } = await db.rpc("crm_distribute_form_lead", {
    p_owner: input.ownerId, p_source: input.source, p_form: input.formId,
    p_page: input.pageId ?? "", p_event: input.eventId, p_payload: input.payload,
  });
  // Never fall back to a different recipient if routing failed.
  if (error) throw new Error(error.message);
  const result = data as RouletteResult;
  if (result.status === "distributed" && result.lead_id && result.pipeline_id && result.stage_id) {
    try {
      await getPlatformEventBus().publish("lead.stage.entered", {
        leadId: result.lead_id, pipelineId: result.pipeline_id, stageId: result.stage_id,
        fromStageId: null, userId: input.ownerId,
      });
    } catch (error) { console.error("[roleta] Falha ao publicar entrada na etapa", error); }
  }
  return result;
}
