import type { SupabaseClient } from "@supabase/supabase-js";
import type { CrmStage } from "@/types/crm";

export interface StageRow extends Pick<CrmStage, "id" | "pipeline_id" | "user_id" | "require_note" | "allow_free_move" | "legacy_column"> {}

export class PipelineRepository {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly db: SupabaseClient<any, any, any>) {}

  async findStageById(stageId: string, userId: string): Promise<StageRow | null> {
    const { data } = await this.db
      .from("crm_stages")
      .select("id, pipeline_id, user_id, require_note, allow_free_move, legacy_column")
      .eq("id", stageId)
      .eq("user_id", userId)
      .maybeSingle();
    return data ?? null;
  }
}
