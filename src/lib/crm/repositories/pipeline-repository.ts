import type { SupabaseClient } from "@supabase/supabase-js";
import type { CrmStage } from "@/types/crm";

export interface StageRow extends Pick<CrmStage, "id" | "pipeline_id" | "user_id" | "require_note" | "allow_free_move" | "legacy_column" | "order_index" | "is_won" | "is_lost"> {}

export class PipelineRepository {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly db: SupabaseClient<any, any, any>) {}

  async findStageById(stageId: string): Promise<StageRow | null> {
    const { data } = await this.db
      .from("crm_stages")
      .select("id, pipeline_id, user_id, require_note, allow_free_move, legacy_column, order_index, is_won, is_lost")
      .eq("id", stageId)
      .maybeSingle();
    return data ?? null;
  }

  // Usado pelo cálculo de IE — LeadScoreEngine.calculateIE precisa do total de
  // etapas ATIVAS da pipeline (etapas arquivadas não contam na proporção).
  async countActiveStages(pipelineId: string): Promise<number> {
    const { count } = await this.db
      .from("crm_stages")
      .select("id", { count: "exact", head: true })
      .eq("pipeline_id", pipelineId)
      .eq("is_active", true);
    return count ?? 0;
  }
}
