// Generic platform domain events — producible by any module (CRM, Forms, Financial, …).
// CRM is one producer of these events; other modules may publish the same types.

export type DomainEventType =
  | "lead.created"
  | "lead.updated"
  | "lead.deleted"
  | "lead.stage.entered"
  | "lead.stage.left"
  // CRM module — workflow engine triggers (Fase 1 do motor de automação)
  | "lead.deal.won"
  | "lead.deal.lost"
  | "lead.tag.added"
  | "lead.tag.removed"
  // Forms module
  | "form.submitted"
  // Appointments module — calendar lifecycle
  | "calendar.created"
  | "calendar.updated"
  | "calendar.archived"
  // Appointments module — booking lifecycle (Phase 2+)
  | "booking.created"
  | "booking.confirmed"
  | "booking.cancelled"
  | "booking.completed"
  | "booking.rescheduled"
  | "booking.no_show"
  // Workspace module — task lifecycle (Fase 3 conecta os publish(); os tipos
  // abaixo além destes 3 — task.commented, task.mentioned,
  // task.checklist_completed, task.priority_changed, task.due_date_changed,
  // task.attachment_added, task.archived — são extensões futuras previstas
  // pela seção 12 do pedido original, ainda não implementadas)
  | "task.assigned"
  | "task.status_changed"
  | "task.completed"
  // Workspace module — Onboarding (submódulo compartilhado). Só
  // onboarding.task_assigned e onboarding.comment_added são publicados hoje;
  // stage_completed/project_completed/document_requested são declarados aqui
  // como extensão futura prevista, mesmo padrão já usado acima para
  // task.commented/mentioned/etc — nada consome esses 3 ainda.
  | "onboarding.task_assigned"
  | "onboarding.stage_completed"
  | "onboarding.project_completed"
  | "onboarding.comment_added"
  | "onboarding.document_requested"
  // Clientes module — NPS
  | "nps.response_received";

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

// ── CRM — workflow engine trigger payloads ────────────────────────────────────

export interface LeadDealWonPayload {
  leadId:     string;
  pipelineId: string;
  stageId:    string;
  dealValue:  number | null;
  userId:     string;
}

export interface LeadDealLostPayload {
  leadId:     string;
  pipelineId: string;
  stageId:    string;
  userId:     string;
}

export interface LeadTagChangedPayload {
  leadId: string;
  tagId:  string;
  userId: string;
}

// ── Forms module payloads ────────────────────────────────────────────────────

export interface FormSubmittedPayload {
  formId:              string;
  formSlug:            string;
  formName:            string;
  submissionId:        string;
  userId:              string;
  leadId:              string | null;
  visitorName:         string | null;
  visitorEmail:        string | null;
  visitorPhone:        string | null;
  hasScheduledBooking: boolean;
  calendarId:          string | null;
  bookingId:           string | null;
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
  calendarName: string;
  userId:       string;
  visitorName:  string;
  visitorEmail: string;
  visitorPhone: string | null;
  startsAt:     string;
  attribution:  Record<string, unknown>;
  /**
   * Null at booking.created time (o sync CRM ainda não rodou nesta mesma
   * request). Populado a partir de booking.confirmed/completed/cancelled/
   * no_show em diante, quando `appointment_bookings.lead_id` já existe.
   */
  leadId:       string | null;
}

// Per-event aliases — all identical in shape today; kept separate so each
// event can evolve its payload independently in the future.
export type BookingCreatedPayload   = BookingEventPayload;
export type BookingConfirmedPayload = BookingEventPayload;
export type BookingCompletedPayload = BookingEventPayload;
export type BookingCancelledPayload = BookingEventPayload;
export type BookingNoShowPayload    = BookingEventPayload;

// ── Workspace module — task lifecycle payloads ────────────────────────────────
// assigneeIds carrega TODOS os responsáveis da tarefa; actorUserId é quem
// executou a ação (criou/moveu) e nunca deve ser notificado sobre sua própria
// ação, mesmo quando também está em assigneeIds.

export interface TaskAssignedPayload {
  taskId:      string;
  taskTitle:   string;
  assigneeIds: string[];
  actorUserId: string;
  priority:    string;
  dueDate:     string | null;
}

export interface TaskStatusChangedPayload {
  taskId:      string;
  taskTitle:   string;
  assigneeIds: string[];
  actorUserId: string;
  fromStatus:  string;
  toStatus:    string;
}

// task.completed é um caso específico de status_changed (toStatus === "concluido");
// mesmo formato de payload, tratado como evento próprio para que o consumer
// escolha a preferência certa (notify_on_completion vs. notify_on_status_change).
export type TaskCompletedPayload = TaskStatusChangedPayload;

// ── Workspace module — Onboarding payloads ────────────────────────────────────

export interface OnboardingTaskAssignedPayload {
  taskId:        string;
  taskTitle:     string;
  projectId:     string;
  projectName:   string;
  assigneeProfileId: string;
  actorUserId:   string;
}

export interface OnboardingCommentAddedPayload {
  taskId:      string;
  taskTitle:   string;
  projectId:   string;
  actorUserId: string;
}

// ── Clientes module — NPS ──────────────────────────────────────────────────────

export interface NpsResponseReceivedPayload {
  userId:         string;
  clientId:       string;
  clientName:     string;
  score:          number;
  referenceMonth: string;
  comment:        string | null;
}
