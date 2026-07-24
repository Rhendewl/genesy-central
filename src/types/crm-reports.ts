export type CrmActivityType =
  | "lead_created" | "lead_pipeline_copied" | "lead_deleted" | "stage_changed" | "deal_won" | "deal_lost"
  | "assignee_changed" | "note_added" | "note_updated" | "note_deleted"
  | "stage_note" | "tags_changed" | "deal_value_changed";

export interface CrmActivity {
  id: string;
  lead_id: string | null;
  pipeline_id: string | null;
  stage_id: string | null;
  actor_user_id: string | null;
  assigned_to: string | null;
  event_type: CrmActivityType;
  lead_name: string;
  lead_contact: string | null;
  source: string | null;
  deal_value: number;
  from_stage_name: string | null;
  to_stage_name: string | null;
  note_content: string | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
  actor_name: string;
  assignee_name: string;
  pipeline_name: string;
}

export interface CrmReportSummary {
  totalActivities: number;
  leadsCreated: number;
  leadsWorked: number;
  stageMovements: number;
  dealsWon: number;
  dealsLost: number;
  wonValue: number;
  averageTicket: number;
  conversionRate: number;
  notesAdded: number;
}

export interface CrmReportBreakdown {
  id: string;
  label: string;
  activities: number;
  leads: number;
  wins: number;
  value: number;
}

export interface CrmReportResponse {
  period: { from: string; to: string };
  summary: CrmReportSummary;
  activities: CrmActivity[];
  byStage: CrmReportBreakdown[];
  byAssignee: CrmReportBreakdown[];
  bySource: CrmReportBreakdown[];
  options: {
    pipelines: { id: string; name: string }[];
    assignees: { id: string; name: string }[];
  };
}
