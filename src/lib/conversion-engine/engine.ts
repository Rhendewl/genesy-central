import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventConsumer } from "@/lib/event-bus/types";
import { ConsumerPriority } from "@/lib/event-bus/types";
import type { LeadStageEnteredPayload } from "@/lib/event-bus/domain-events";
import { dispatchConversions } from "./dispatcher";

// Side-effect: registers all platform providers into the registry.
import "./providers/meta";
import "./providers/google";
import "./providers/tiktok";

// ─────────────────────────────────────────────────────────────────────────────
// Conversion Engine — EventConsumer factory
//
// Returns a consumer that listens to "lead.stage.entered" domain events
// and decides which platform conversions to fire, using only the stageId
// from the event payload — no direct knowledge of Meta/Google/TikTok.
//
// CRM publishes these generic events; the engine is a separate concern.
// ─────────────────────────────────────────────────────────────────────────────

export interface ConversionEngineOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any, any, any>;
}

export function createConversionEngine(opts: ConversionEngineOptions): EventConsumer {
  return {
    name:     "conversion-engine",
    priority: ConsumerPriority.NORMAL,
    events:   ["lead.stage.entered"],

    async handle(event): Promise<void> {
      const payload = event.payload as LeadStageEnteredPayload;
      if (!payload?.stageId) return;
      await dispatchConversions(opts.db, payload.stageId, event);
    },
  };
}
