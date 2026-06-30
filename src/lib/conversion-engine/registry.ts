import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusEvent } from "@/lib/event-bus/types";
import type { CrmStageConversion } from "@/types/crm";

// ─────────────────────────────────────────────────────────────────────────────
// Conversion Engine — Provider Registry
//
// Mirrors src/lib/integrations/registry.ts: a platform name maps to exactly
// one provider. No caller (engine, dispatcher) ever references Meta, Google
// or TikTok by name — they only see the registry.
// ─────────────────────────────────────────────────────────────────────────────

export interface ProviderContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db:  SupabaseClient<any, any, any>;
  // Single timestamp reference for the whole dispatch attempt — used for
  // persistence (last_success_at/last_error_at) and logs. Not used for
  // event_time (that comes from event.timestamp, stable across retries).
  // Reserved for future: logger, metrics, featureFlags, secretsProvider.
  now: Date;
}

export interface ConversionProvider {
  readonly platform: string;
  execute(conversion: CrmStageConversion, event: BusEvent, context: ProviderContext): Promise<void>;
}

const providers = new Map<string, ConversionProvider>();

export function registerConversionProvider(provider: ConversionProvider): void {
  providers.set(provider.platform, provider);
}

export function resolveConversionProvider(platform: string): ConversionProvider | undefined {
  return providers.get(platform);
}

export function registeredPlatforms(): string[] {
  return Array.from(providers.keys());
}
