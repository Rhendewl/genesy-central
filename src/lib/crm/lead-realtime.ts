import type { Lead } from "@/types";

export interface LeadStageRealtimeMessage {
  leadId: string;
  stageId: string | null;
  updatedAt: string;
  mutationId: string;
  rollback?: boolean;
}

export function parseLeadStageRealtimeMessage(value: unknown): LeadStageRealtimeMessage | null {
  if (!value || typeof value !== "object") return null;
  const message = value as Record<string, unknown>;
  if (typeof message.leadId !== "string" || !message.leadId) return null;
  if (message.stageId !== null && typeof message.stageId !== "string") return null;
  if (typeof message.updatedAt !== "string" || Number.isNaN(Date.parse(message.updatedAt))) return null;
  if (typeof message.mutationId !== "string" || !message.mutationId) return null;
  return {
    leadId: message.leadId,
    stageId: message.stageId as string | null,
    updatedAt: message.updatedAt,
    mutationId: message.mutationId,
    rollback: message.rollback === true,
  };
}

export function applyLeadStageRealtimeMessage(leads: Lead[], message: LeadStageRealtimeMessage): Lead[] {
  return leads.map((lead) => lead.id === message.leadId
    ? { ...lead, stage_id: message.stageId, updated_at: message.updatedAt }
    : lead);
}
