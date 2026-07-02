// Generic platform domain events — producible by any module (CRM, Forms, Financial, …).
// CRM is one producer of these events; other modules may publish the same types.

export type DomainEventType =
  | "lead.created"
  | "lead.updated"
  | "lead.deleted"
  | "lead.stage.entered"
  | "lead.stage.left"
  // Appointments module — calendar lifecycle
  | "calendar.created"
  | "calendar.updated"
  | "calendar.archived"
  // Appointments module — booking lifecycle (Phase 2+)
  | "booking.created"
  | "booking.confirmed"
  | "booking.cancelled"
  | "booking.completed"
  | "booking.rescheduled";

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

// ── Appointments module payloads ──────────────────────────────────────────────

export interface CalendarCreatedPayload {
  calendarId: string;
  userId:     string;
  name:       string;
  slug:       string;
}

export interface CalendarUpdatedPayload {
  calendarId: string;
  userId:     string;
  changes:    Record<string, unknown>;
}

export interface CalendarArchivedPayload {
  calendarId: string;
  userId:     string;
}
