// Generic platform domain events — producible by any module (CRM, Forms, Financial, …).
// CRM is one producer of these events; other modules may publish the same types.

export type DomainEventType =
  | "lead.created"
  | "lead.updated"
  | "lead.deleted"
  | "lead.stage.entered"
  | "lead.stage.left";

export interface LeadCreatedPayload {
  leadId:     string;
  pipelineId: string | null;
  stageId:    string | null;
  userId:     string;
}

export interface LeadUpdatedPayload {
  leadId:  string;
  changes: Record<string, unknown>;
  userId:  string;
}

export interface LeadDeletedPayload {
  leadId: string;
  userId: string;
}

export interface LeadStageEnteredPayload {
  leadId:      string;
  pipelineId:  string;
  stageId:     string;
  fromStageId: string | null;
  userId:      string;
}

export interface LeadStageLeftPayload {
  leadId:     string;
  pipelineId: string;
  stageId:    string;
  toStageId:  string | null;
  userId:     string;
}
