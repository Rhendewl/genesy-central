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

// ── Booking events ────────────────────────────────────────────────────────────

/**
 * Shared shape for all booking lifecycle events that carry visitor data.
 * Resolvers and consumers depend on this interface, not on event-specific types,
 * so adding a new lifecycle event (booking.completed, booking.rescheduled …)
 * never requires changes to existing resolvers.
 */
export interface BookingEventPayload {
  bookingId:    string;
  calendarId:   string;
  userId:       string;
  visitorName:  string;
  visitorEmail: string;
  visitorPhone: string | null;
  startsAt:     string;
  attribution:  Record<string, unknown>;
}

// Per-event aliases — all identical in shape today; kept separate so each
// event can evolve its payload independently in the future.
export type BookingCreatedPayload   = BookingEventPayload;
export type BookingConfirmedPayload = BookingEventPayload;
