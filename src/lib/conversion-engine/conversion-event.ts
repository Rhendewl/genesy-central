import type { Attribution, EventContext } from "./event-context";
import type { IdentitySignals } from "./identity-signals";
import { deriveActionSource, type ActionSource } from "@/lib/crm/lead-source";

// ─────────────────────────────────────────────────────────────────────────────
// Conversion Engine — ConversionEvent
//
// Platform-agnostic domain model that sits between EventContext and providers.
//
//   EventContext  →  buildConversionEvent()  →  ConversionEvent
//                                                      ↓
//                                             Provider (Meta, Google, TikTok…)
//                                                      ↓
//                                             Platform-specific payload
//
// ConversionEvent knows nothing about Meta, Google or TikTok.
// Providers know nothing about leads, sessions or database tables.
// ─────────────────────────────────────────────────────────────────────────────

// ── Domain blocks ─────────────────────────────────────────────────────────────

/** Commerce signals available to any conversion provider. */
export interface Commerce {
  dealValue: number;
}

/** CRM positioning and lead metadata available to any conversion provider. */
export interface CrmContext {
  leadId:       string;
  pipelineId:   string;
  stageId:      string;
  fromStageId:  string | null;
  leadSource:   string;
  campaignName: string | null;
  adName:       string | null;
}

// ── ConversionEvent ───────────────────────────────────────────────────────────

/**
 * Public contract consumed by all conversion providers.
 *
 * EventContext is an internal implementation detail of the Conversion Engine.
 * Providers must never depend on it directly — only on ConversionEvent.
 * This decoupling ensures that changes to the internal enrichment logic
 * (queries, session structure, table schema) never require provider changes.
 *
 *   EventContext (internal)
 *        ↓
 *   buildConversionEvent()
 *        ↓
 *   ConversionEvent (public contract)
 *        ↓
 *   Provider → platform-specific payload
 */
export interface ConversionEvent {
  // ── Event identity ─────────────────────────────────────────────────────
  eventId:        string;
  eventTimestamp: number;
  correlationId:  string;

  // ── Domain blocks ──────────────────────────────────────────────────────
  identity:    IdentitySignals;
  attribution: Attribution;
  commerce:    Commerce;

  // Present for CRM-originated events (lead.stage.entered).
  // Absent for events from other domains (booking.created, checkout.completed…).
  crm?: CrmContext;

  // ── Derived classification ─────────────────────────────────────────────
  actionSource: ActionSource;
}

// ── Builder ───────────────────────────────────────────────────────────────────

export function buildConversionEvent(ctx: EventContext): ConversionEvent {
  return {
    eventId:        ctx.eventId,
    eventTimestamp: ctx.eventTimestamp,
    correlationId:  ctx.correlationId,

    identity:    ctx.identity,
    attribution: ctx.attribution,

    commerce: {
      dealValue: ctx.lead.deal_value,
    },

    crm: {
      leadId:       ctx.leadId,
      pipelineId:   ctx.pipelineId,
      stageId:      ctx.stageId,
      fromStageId:  ctx.fromStageId,
      leadSource:   ctx.lead.source,
      campaignName: ctx.lead.campaign_name,
      adName:       ctx.lead.ad_name,
    },

    actionSource: deriveActionSource(ctx.lead.source),
  };
}

// Re-export for consumers importing from this module.
export type { ActionSource };
