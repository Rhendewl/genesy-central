import type { SupabaseClient }            from "@supabase/supabase-js";
import type { BusEvent }                  from "@/lib/event-bus/types";
import type { LeadStageEnteredPayload }   from "@/lib/event-bus/domain-events";
import { buildEventContext }              from "../event-context";
import { buildConversionEvent }           from "../conversion-event";
import { deriveActionSource }             from "@/lib/crm/lead-source";
import type { ConversionEventResolver, ConversionRule, ResolvedConversion } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

// ─────────────────────────────────────────────────────────────────────────────
// CRM Resolver
//
// First implementation of ConversionEventResolver.
// Handles "lead.stage.entered" events produced by LeadService.
//
// Responsibilities:
//   1. Load enabled crm_stage_conversions for the stage in the event payload.
//   2. Enrich the event with lead + submission + session (buildEventContext).
//   3. Map to a domain-agnostic ConversionEvent via buildConversionEvent().
//   4. Return rules + event — dispatcher takes it from here.
//
// This is the ONLY place in the engine that knows about crm_stage_conversions,
// leads, or form_submissions. Adding a new domain never touches this file.
// ─────────────────────────────────────────────────────────────────────────────

export const crmResolver: ConversionEventResolver = {
  events: ["lead.stage.entered"],

  async resolve(db: Db, event: BusEvent): Promise<ResolvedConversion | null> {
    const payload = event.payload as LeadStageEnteredPayload;
    if (!payload?.stageId) return null;

    // 1. Load enabled conversion rules for this stage
    const { data: rows } = await db
      .from("crm_stage_conversions")
      .select("id, platform, platform_integration_id, settings, enabled")
      .eq("stage_id", payload.stageId)
      .eq("enabled", true);

    if (!rows?.length) return null;

    // 2. Enrich: load lead + submission + session in parallel
    const ctx = await buildEventContext(db, event, payload);
    if (!ctx) return null;  // lead deleted between publish and dispatch

    // 3. Map to platform-agnostic contract via the shared builder
    const conversionEvent = buildConversionEvent({
      event,
      identity:     ctx.identity,
      attribution:  ctx.attribution,
      commerce:     { dealValue: ctx.lead.deal_value },
      actionSource: deriveActionSource(ctx.lead.source),
      crm: {
        leadId:       ctx.leadId,
        pipelineId:   ctx.pipelineId,
        stageId:      ctx.stageId,
        fromStageId:  ctx.fromStageId,
        leadSource:   ctx.lead.source,
        campaignName: ctx.lead.campaign_name,
        adName:       ctx.lead.ad_name,
      },
    });

    const rules: ConversionRule[] = rows.map(r => ({
      id:                      r.id                      as string,
      platform:                r.platform                as string,
      platform_integration_id: r.platform_integration_id as string | null,
      settings:                r.settings                as Record<string, unknown>,
      enabled:                 r.enabled                 as boolean,
    }));

    return { conversionEvent, rules };
  },
};
