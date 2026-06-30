import type { SupabaseClient } from "@supabase/supabase-js";

export interface LeadRow {
  id:            string;
  user_id:       string;
  pipeline_id:   string | null;
  stage_id:      string | null;
  kanban_column: string | null;
}

export interface MoveLeadRpcParams {
  leadId:   string;
  userId:   string;
  stageId:  string;
  note:     string | null;
  movedBy:  string | null;
}

export interface MoveLeadRpcResult {
  lead_id:       string;
  pipeline_id:   string;
  stage_id:      string;
  from_stage_id: string | null;
  from_column:   string | null;
  to_column:     string | null;
}

export class LeadRepository {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly db: SupabaseClient<any, any, any>) {}

  async findById(leadId: string, userId: string): Promise<LeadRow | null> {
    const { data } = await this.db
      .from("leads")
      .select("id, user_id, pipeline_id, stage_id, kanban_column")
      .eq("id", leadId)
      .eq("user_id", userId)
      .maybeSingle();
    return data ?? null;
  }

  // Calls the crm_move_lead Postgres function: atomically updates the lead,
  // inserts crm_lead_stage_history and lead_movements within one transaction,
  // then returns the result. LeadService publishes events only after this resolves.
  async moveLeadTransactional(params: MoveLeadRpcParams): Promise<MoveLeadRpcResult> {
    const { data, error } = await this.db.rpc("crm_move_lead", {
      p_lead_id:  params.leadId,
      p_user_id:  params.userId,
      p_stage_id: params.stageId,
      p_note:     params.note,
      p_moved_by: params.movedBy,
    });

    if (error) throw new Error(error.message);

    const rows = data as MoveLeadRpcResult[] | null;
    if (!rows?.length) throw new Error("MOVE_FAILED");

    return rows[0];
  }
}
