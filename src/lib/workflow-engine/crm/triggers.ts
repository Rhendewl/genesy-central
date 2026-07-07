import type { TriggerResolver, TriggerMatchContext, TriggerMatchResult } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Gatilhos de CRM (Fase 1) — os 10 pedidos. Fluxo do consumer:
//   1. resolvePipelineId(ctx) — acha a pipeline do evento (sem olhar config
//      de nenhuma automação ainda), pra buscar só as automações candidatas.
//   2. match(ctx, automation.trigger_config) — decide, por automação, se o
//      evento realmente casa com a config específica dela (ex: qual etapa).
// ─────────────────────────────────────────────────────────────────────────────

interface LeadStageEventPayload {
  leadId: string; pipelineId: string; stageId: string; userId: string;
}
interface LeadDealEventPayload {
  leadId: string; pipelineId: string; stageId: string; userId: string;
}
interface LeadTagEventPayload {
  leadId: string; tagId: string; userId: string;
}
interface BookingEventPayload {
  bookingId: string; leadId: string | null; userId: string;
}

async function buildSnapshot(ctx: TriggerMatchContext, leadId: string, stageId?: string): Promise<Record<string, unknown>> {
  const { data: lead } = await ctx.db.from("leads").select("stage_id, assigned_to").eq("id", leadId).maybeSingle();
  const row = lead as { stage_id: string | null; assigned_to: string | null } | null;
  return {
    stageId:    stageId ?? row?.stage_id ?? null,
    assignedTo: row?.assigned_to ?? null,
  };
}

async function pipelineIdOfLead(ctx: TriggerMatchContext, leadId: string): Promise<string | null> {
  const { data } = await ctx.db.from("leads").select("pipeline_id").eq("id", leadId).maybeSingle();
  return (data as { pipeline_id: string | null } | null)?.pipeline_id ?? null;
}

async function leadIdOfBooking(ctx: TriggerMatchContext, bookingId: string): Promise<string | null> {
  const { data } = await ctx.db.from("appointment_bookings").select("lead_id").eq("id", bookingId).maybeSingle();
  return (data as { lead_id: string | null } | null)?.lead_id ?? null;
}

const stageEntered: TriggerResolver = {
  type: "crm.lead.stage_entered",
  listensTo: ["lead.stage.entered"],
  async resolvePipelineId(ctx) {
    return (ctx.event.payload as LeadStageEventPayload).pipelineId ?? null;
  },
  async match(ctx, config): Promise<TriggerMatchResult> {
    const p = ctx.event.payload as LeadStageEventPayload;
    if (config.stageId && p.stageId !== config.stageId) return { matched: false };
    return { matched: true, recordId: p.leadId, snapshot: await buildSnapshot(ctx, p.leadId, p.stageId) };
  },
};

const stageLeft: TriggerResolver = {
  type: "crm.lead.stage_left",
  listensTo: ["lead.stage.left"],
  async resolvePipelineId(ctx) {
    return (ctx.event.payload as LeadStageEventPayload).pipelineId ?? null;
  },
  async match(ctx, config): Promise<TriggerMatchResult> {
    const p = ctx.event.payload as LeadStageEventPayload;
    if (config.stageId && p.stageId !== config.stageId) return { matched: false };
    return { matched: true, recordId: p.leadId, snapshot: await buildSnapshot(ctx, p.leadId) };
  },
};

const stageChangedAny: TriggerResolver = {
  type: "crm.lead.stage_changed_any",
  listensTo: ["lead.stage.entered"],
  async resolvePipelineId(ctx) {
    return (ctx.event.payload as LeadStageEventPayload).pipelineId ?? null;
  },
  async match(ctx): Promise<TriggerMatchResult> {
    const p = ctx.event.payload as LeadStageEventPayload & { fromStageId: string | null };
    if (!p.fromStageId) return { matched: false }; // criação, não movimentação
    return { matched: true, recordId: p.leadId, snapshot: await buildSnapshot(ctx, p.leadId, p.stageId) };
  },
};

const dealWon: TriggerResolver = {
  type: "crm.lead.deal_won",
  listensTo: ["lead.deal.won"],
  async resolvePipelineId(ctx) {
    return (ctx.event.payload as LeadDealEventPayload).pipelineId ?? null;
  },
  async match(ctx): Promise<TriggerMatchResult> {
    const p = ctx.event.payload as LeadDealEventPayload;
    return { matched: true, recordId: p.leadId, snapshot: await buildSnapshot(ctx, p.leadId, p.stageId) };
  },
};

const dealLost: TriggerResolver = {
  type: "crm.lead.deal_lost",
  listensTo: ["lead.deal.lost"],
  async resolvePipelineId(ctx) {
    return (ctx.event.payload as LeadDealEventPayload).pipelineId ?? null;
  },
  async match(ctx): Promise<TriggerMatchResult> {
    const p = ctx.event.payload as LeadDealEventPayload;
    return { matched: true, recordId: p.leadId, snapshot: await buildSnapshot(ctx, p.leadId, p.stageId) };
  },
};

const tagAdded: TriggerResolver = {
  type: "crm.lead.tag_added",
  listensTo: ["lead.tag.added"],
  async resolvePipelineId(ctx) {
    return pipelineIdOfLead(ctx, (ctx.event.payload as LeadTagEventPayload).leadId);
  },
  async match(ctx, config): Promise<TriggerMatchResult> {
    const p = ctx.event.payload as LeadTagEventPayload;
    if (config.tagId && p.tagId !== config.tagId) return { matched: false };
    return { matched: true, recordId: p.leadId, snapshot: await buildSnapshot(ctx, p.leadId) };
  },
};

const tagRemoved: TriggerResolver = {
  type: "crm.lead.tag_removed",
  listensTo: ["lead.tag.removed"],
  async resolvePipelineId(ctx) {
    return pipelineIdOfLead(ctx, (ctx.event.payload as LeadTagEventPayload).leadId);
  },
  async match(ctx, config): Promise<TriggerMatchResult> {
    const p = ctx.event.payload as LeadTagEventPayload;
    if (config.tagId && p.tagId !== config.tagId) return { matched: false };
    return { matched: true, recordId: p.leadId, snapshot: await buildSnapshot(ctx, p.leadId) };
  },
};

const meetingScheduled: TriggerResolver = {
  type: "crm.lead.meeting_scheduled",
  listensTo: ["booking.created"],
  async resolvePipelineId(ctx) {
    const p = ctx.event.payload as BookingEventPayload;
    const leadId = await leadIdOfBooking(ctx, p.bookingId);
    return leadId ? pipelineIdOfLead(ctx, leadId) : null;
  },
  async match(ctx): Promise<TriggerMatchResult> {
    const p = ctx.event.payload as BookingEventPayload;
    // No momento de booking.created o sync CRM ainda não rodou (mesma
    // request, ordem de execução) — payload.leadId não é confiável aqui,
    // então resolvemos direto na tabela de agendamentos.
    const leadId = await leadIdOfBooking(ctx, p.bookingId);
    if (!leadId) return { matched: false };
    return { matched: true, recordId: leadId, snapshot: await buildSnapshot(ctx, leadId) };
  },
};

const meetingAttended: TriggerResolver = {
  type: "crm.lead.meeting_attended",
  listensTo: ["booking.completed"],
  async resolvePipelineId(ctx) {
    const p = ctx.event.payload as BookingEventPayload;
    return p.leadId ? pipelineIdOfLead(ctx, p.leadId) : null;
  },
  async match(ctx): Promise<TriggerMatchResult> {
    const p = ctx.event.payload as BookingEventPayload;
    if (!p.leadId) return { matched: false };
    return { matched: true, recordId: p.leadId, snapshot: await buildSnapshot(ctx, p.leadId) };
  },
};

const meetingNoShow: TriggerResolver = {
  type: "crm.lead.meeting_no_show",
  listensTo: ["booking.no_show"],
  async resolvePipelineId(ctx) {
    const p = ctx.event.payload as BookingEventPayload;
    return p.leadId ? pipelineIdOfLead(ctx, p.leadId) : null;
  },
  async match(ctx): Promise<TriggerMatchResult> {
    const p = ctx.event.payload as BookingEventPayload;
    if (!p.leadId) return { matched: false };
    return { matched: true, recordId: p.leadId, snapshot: await buildSnapshot(ctx, p.leadId) };
  },
};

export const crmTriggerResolvers: TriggerResolver[] = [
  stageEntered, stageLeft, stageChangedAny, dealWon, dealLost,
  tagAdded, tagRemoved, meetingScheduled, meetingAttended, meetingNoShow,
];
