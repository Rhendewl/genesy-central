import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConversionRule }  from "./event-resolvers/types";
import type { ConversionEvent } from "./conversion-event";

// ─────────────────────────────────────────────────────────────────────────────
// Conversion Engine — Provider Registry
//
// A platform name maps to exactly one provider. No caller (engine, dispatcher)
// ever references Meta, Google or TikTok by name — they only see the registry.
//
// Provider contract:
//   1. Load platform credentials (Pixel ID, Access Token, API Key…).
//   2. Translate ConversionEvent into the platform-specific payload.
//   3. Send the request.
//   4. Persist success / error.
//
// Providers never query the database for event data — that is ConversionEvent's
// responsibility. The only allowed DB access is credential loading.
// ─────────────────────────────────────────────────────────────────────────────

export interface ProviderContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db:  SupabaseClient<any, any, any>;
  // Single timestamp reference for the whole dispatch attempt — used for
  // persistence (last_success_at/last_error_at) and logs. Not used for
  // event_time (that comes from event.timestamp, stable across retries).
  now: Date;
}

export interface ConversionProvider {
  readonly platform: string;
  execute(rule: ConversionRule, conversionEvent: ConversionEvent, context: ProviderContext): Promise<void>;
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
