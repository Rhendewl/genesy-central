import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusEvent } from "@/lib/event-bus/types";
import { resolveConversionProvider, type ProviderContext } from "./registry";

// ─────────────────────────────────────────────────────────────────────────────
// Conversion Engine — Dispatcher
//
// Loads enabled crm_stage_conversions for a stage, resolves providers from
// the registry, and executes them in parallel (isolated: one failure does not
// cancel others). Called by the engine on every lead.stage.entered event.
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function dispatchConversions(db: SupabaseClient<any, any, any>, stageId: string, event: BusEvent): Promise<void> {
  const { data: conversions } = await db
    .from("crm_stage_conversions")
    .select("*")
    .eq("stage_id", stageId)
    .eq("enabled", true);

  if (!conversions?.length) return;

  const context: ProviderContext = { db, now: new Date() };

  const results = await Promise.allSettled(
    conversions.map((conversion) => {
      const provider = resolveConversionProvider(conversion.platform as string);
      if (!provider) return Promise.resolve();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return provider.execute(conversion as any, event, context);
    }),
  );

  // Isolation is preserved above (allSettled lets every provider run to
  // completion regardless of others failing). Once all have settled, surface
  // the first failure so ConversionEngine.handle() rejects and the EventBus
  // applies its normal retry policy.
  const rejected = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
  if (rejected) throw rejected.reason;
}
