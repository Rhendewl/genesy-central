import type { SupabaseClient } from "@supabase/supabase-js";

export interface LeadRow {
  id:            string;
  user_id:       string;
  pipeline_id:   string | null;
  stage_id:      string | null;
  kanban_column: string | null;
}

export interface CreateLeadParams {
  user_id:       string;
  pipeline_id:   string;
  stage_id:      string;
  kanban_column: string | null;
  name:          string;
  contact:       string;
  email:         string | null;
  source:        string;
  form_id?:      string | null;
  form_name?:    string | null;
  tags?:         string[];
  deal_value?:   number;
  notes?:        string | null;
  entered_at?:   string;
  is_duplicate?: boolean;
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

  async createLead(params: CreateLeadParams): Promise<string> {
    const { data, error } = await this.db
      .from("leads")
      .insert({
        user_id:       params.user_id,
        pipeline_id:   params.pipeline_id,
        stage_id:      params.stage_id,
        kanban_column: params.kanban_column,
        name:          params.name,
        contact:       params.contact,
        email:         params.email,
        source:        params.source,
        form_id:       params.form_id       ?? null,
        form_name:     params.form_name     ?? null,
        tags:          params.tags          ?? [],
        deal_value:    params.deal_value    ?? 0,
        notes:         params.notes         ?? null,
        entered_at:    params.entered_at    ?? new Date().toISOString().split("T")[0],
        is_duplicate:  params.is_duplicate  ?? false,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    await this.db.from("crm_lead_stage_history").insert({
      lead_id:     data.id,
      pipeline_id: params.pipeline_id,
      stage_id:    params.stage_id,
      from_column: null,
      to_column:   params.kanban_column,
      moved_by:    null,
      note:        null,
    });

    return data.id;
  }

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
