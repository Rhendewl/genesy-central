import type { SupabaseClient } from "@supabase/supabase-js";
import type { CrmLeadStageHistory } from "@/types/crm";

export class LeadHistoryRepository {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly db: SupabaseClient<any, any, any>) {}

  // Writes to crm_lead_stage_history are handled atomically inside the
  // crm_move_lead Postgres function. This method is for reading history
  // (e.g. Phase 2 lead timeline drawer).
  async listByLeadId(leadId: string): Promise<CrmLeadStageHistory[]> {
    const { data } = await this.db
      .from("crm_lead_stage_history")
      .select("*")
      .eq("lead_id", leadId)
      .order("moved_at", { ascending: false });
    return (data ?? []) as CrmLeadStageHistory[];
  }
}
