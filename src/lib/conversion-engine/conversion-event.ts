import type { Attribution } from "./event-context";
import type { IdentitySignals } from "./identity-signals";
import { type ActionSource } from "@/lib/crm/lead-source";

// ─────────────────────────────────────────────────────────────────────────────
// Conversion Engine — ConversionEvent
//
// Platform-agnostic domain model that sits between domain resolvers and providers.
//
//   Resolver (any domain)
//        ↓
//   buildConversionEvent(input)
//        ↓
//   ConversionEvent  →  Provider (Meta, Google, TikTok…)  →  platform payload
//
// ConversionEvent knows nothing about Meta, Google or TikTok.
// Providers know nothing about leads, sessions or database tables.
// ─────────────────────────────────────────────────────────────────────────────

// ── Domain blocks ─────────────────────────────────────────────────────────────

/** Commerce signals available to any conversion provider. */
export interface Commerce {
  /** null = no monetary value (booking, lead capture, etc.)
   *  0   = a real deal with zero cost (100 % discount, free tier, etc.) */
  dealValue: number | null;
  /** ISO 4217 code; optional — providers fall back to their own default. */
  currency?: string;
}

/** CRM positioning and lead metadata — present only for CRM-originated events. */
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
 * Providers must never depend on EventContext or any domain-specific structure
 * — only on ConversionEvent.  Adding a new domain (checkout, subscription, …)
 * never requires provider changes.
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

  // Present for CRM-originated events; absent for booking, checkout, etc.
  crm?: CrmContext;

  // ── Derived classification ─────────────────────────────────────────────
  actionSource: ActionSource;
}

// ── Generic builder ───────────────────────────────────────────────────────────

/**
 * Input for the platform-level ConversionEvent builder.
 *
 * Every resolver — CRM, Booking, Checkout, Subscription — uses this builder.
 * Resolvers are responsible for providing pre-built identity and attribution;
 * the builder assembles the envelope without knowing the originating domain.
 */
export interface BuildConversionEventInput {
  /** Event envelope — provides stable identifiers across retries. */
  event:        { id: string; timestamp: number; correlationId: string };
  identity:     IdentitySignals;
  attribution:  Attribution;
  commerce:     Commerce;
  actionSource: ActionSource;
  /** Omit for non-CRM domains (booking, checkout, …). */
  crm?:         CrmContext;
}

export function buildConversionEvent(input: BuildConversionEventInput): ConversionEvent {
  return {
    eventId:        input.event.id,
    eventTimestamp: input.event.timestamp,
    correlationId:  input.event.correlationId,
    identity:       input.identity,
    attribution:    input.attribution,
    commerce:       input.commerce,
    actionSource:   input.actionSource,
    crm:            input.crm,
  };
}

// Re-export for consumers importing from this module.
export type { ActionSource };
