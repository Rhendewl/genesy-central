import type { ConversionEvent } from "./conversion-event";
import type { ConversionRule }  from "./event-resolvers/types";
import { resolveConversionProvider, type ProviderContext } from "./registry";

// ─────────────────────────────────────────────────────────────────────────────
// Conversion Engine — Dispatcher
//
// Receives a fully resolved ConversionEvent and a list of ConversionRules,
// then executes each matching provider in parallel (isolated).
//
// This module has zero knowledge of CRM, Appointments or any other domain.
// All event enrichment and rule selection happens in the resolvers BEFORE
// this function is called.
// ─────────────────────────────────────────────────────────────────────────────

export async function dispatchConversions(
  rules:           ConversionRule[],
  conversionEvent: ConversionEvent,
  context:         ProviderContext,
): Promise<void> {
  if (rules.length === 0) return;

  const results = await Promise.allSettled(
    rules.map(rule => {
      const provider = resolveConversionProvider(rule.platform);
      if (!provider) return Promise.resolve();
      return provider.execute(rule, conversionEvent, context);
    }),
  );

  // Isolation is preserved above (allSettled lets every provider run to
  // completion regardless of others failing). Surface the first failure so
  // the EventBus applies its normal retry policy.
  const rejected = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
  if (rejected) throw rejected.reason;
}
