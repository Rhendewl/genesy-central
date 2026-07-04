import { registerConversionProvider, type ConversionProvider, type ProviderContext } from "../registry";
import type { ConversionEvent }  from "../conversion-event";
import type { IdentitySignals }  from "../identity-signals";
import type { ConversionRule }   from "../event-resolvers/types";
import type { CrmConversionSource, MetaPixelConversionSettings } from "@/types/crm";

// ─────────────────────────────────────────────────────────────────────────────
// Meta Pixel / Conversions API provider
//
// Responsibilities (and only these):
//   1. Load platform credentials (platform_integrations).
//   2. Convert EventContext into a Meta CAPI payload.
//   3. Send the HTTP request to the Graph API.
//   4. Persist success / error back to platform_integrations.
//
// All event data (lead, session, attribution, match keys) arrives pre-built
// in context.eventContext. This provider never queries the database for
// event data, never hashes PII, and never reads table structure.
// ─────────────────────────────────────────────────────────────────────────────

const META_GRAPH_VERSION = "v20.0";
const CAPI_TIMEOUT_MS    = 8_000;

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

type SourceRow = Pick<CrmConversionSource, "id" | "pixel_id" | "access_token" | "test_event_code" | "is_active" | "pipeline_id">;

type SendResult = {
  ok:            boolean;
  statusCode?:   number;
  errorMessage?: string;
  shouldRetry:   boolean;
};

async function loadSource(db: ProviderContext["db"], sourceId: string): Promise<SourceRow | null> {
  const { data } = await db
    .from("platform_integrations")
    .select("id, pixel_id, access_token, test_event_code, is_active, pipeline_id")
    .eq("id", sourceId)
    .maybeSingle();
  return data ?? null;
}

function toMetaUserData(identity: IdentitySignals): Record<string, string> {
  const ud: Record<string, string> = {};
  if (identity.email)      ud.em                = identity.email;
  if (identity.phone)      ud.ph                = identity.phone;
  if (identity.firstName)  ud.fn                = identity.firstName;
  if (identity.lastName)   ud.ln                = identity.lastName;
  if (identity.fbp)        ud.fbp               = identity.fbp;
  if (identity.fbc)        ud.fbc               = identity.fbc;
  if (identity.externalId) ud.external_id       = identity.externalId;
  if (identity.ip)         ud.client_ip_address = identity.ip;
  if (identity.userAgent)  ud.client_user_agent = identity.userAgent;
  if (identity.country)    ud.country           = identity.country;
  if (identity.city)       ud.ct                = identity.city;
  if (identity.state)      ud.st                = identity.state;
  if (identity.zip)        ud.zp                = identity.zip;
  return ud;
}

function buildCapiPayload(
  source:          SourceRow,
  conversionEvent: ConversionEvent,
  settings:        MetaPixelConversionSettings,
) {
  const { identity, attribution, commerce, crm, actionSource } = conversionEvent;

  // ── user_data — translate IdentitySignals into Meta field names ───────────
  const userData = toMetaUserData(identity);

  // ── custom_data ──────────────────────────────────────────────────────────
  const customData: Record<string, unknown> = {};
  // CRM context is optional — present for lead events, absent for booking events.
  if (crm) {
    customData.lead_id     = crm.leadId;
    customData.pipeline_id = crm.pipelineId;
    customData.stage_id    = crm.stageId;
    if (crm.leadSource)   customData.lead_source   = crm.leadSource;
    if (crm.campaignName) customData.campaign_name = crm.campaignName;
    if (crm.adName)       customData.ad_name       = crm.adName;
  }

  // settings.value overrides the dynamic commerce value when explicitly configured.
  // commerce.dealValue: null = no value to send; 0 = a real zero-value deal.
  const value    = settings.value ?? commerce.dealValue;
  const currency = settings.currency ?? commerce.currency ?? "BRL";
  if (value !== null && value !== undefined) {
    customData.value    = value;
    customData.currency = currency;
  }

  // ── event name ───────────────────────────────────────────────────────────
  const eventName = settings.event_name === "CustomEvent" && settings.custom_event_name
    ? settings.custom_event_name
    : settings.event_name;

  // ── API event object ─────────────────────────────────────────────────────
  const apiEvent: Record<string, unknown> = {
    event_name:    eventName,
    event_time:    Math.floor(conversionEvent.eventTimestamp / 1000),
    event_id:      conversionEvent.eventId,
    action_source: actionSource,
    custom_data:   customData,
  };

  if (Object.keys(userData).length > 0) apiEvent.user_data        = userData;
  if (attribution.event_source_url)      apiEvent.event_source_url = attribution.event_source_url;

  return {
    data: [apiEvent],
    ...(source.test_event_code ? { test_event_code: source.test_event_code } : {}),
  };
}

async function sendCapiRequest(
  payload: ReturnType<typeof buildCapiPayload>,
  source:  SourceRow,
): Promise<SendResult> {
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${source.pixel_id}/events?access_token=${encodeURIComponent(source.access_token)}`;

  try {
    const res = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(CAPI_TIMEOUT_MS),
    });

    if (res.ok) return { ok: true, statusCode: res.status, shouldRetry: false };

    const bodyText = await res.text().catch(() => "");
    return {
      ok:           false,
      statusCode:   res.status,
      errorMessage: `HTTP ${res.status}: ${bodyText.slice(0, 500)}`,
      shouldRetry:  RETRYABLE_STATUSES.has(res.status),
    };
  } catch (err) {
    return {
      ok:           false,
      errorMessage: err instanceof Error ? err.message : "network error",
      shouldRetry:  true,
    };
  }
}

async function persistResult(
  db:       ProviderContext["db"],
  sourceId: string,
  result:   SendResult,
  now:      Date,
): Promise<void> {
  const update = result.ok
    ? { last_success_at: now.toISOString(), last_error: null, last_error_at: null }
    : { last_error: result.errorMessage ?? "unknown error", last_error_at: now.toISOString() };

  const { error } = await db.from("platform_integrations").update(update).eq("id", sourceId);
  if (error) console.warn("[conversion-engine] failed to persist meta result", { sourceId, error: error.message });
}

function logSkipped(
  reason: "source not found" | "source inactive" | "source pipeline mismatch",
  ctx:    { source_id?: string; pipeline_id: string; stage_id: string },
): void {
  console.warn("[conversion-engine] dispatch skipped", { provider: "meta_pixel", reason, ...ctx });
}

export const metaConversionProvider: ConversionProvider = {
  platform: "meta_pixel",
  async execute(rule: ConversionRule, conversionEvent: ConversionEvent, context: ProviderContext) {
    const settings = rule.settings as unknown as MetaPixelConversionSettings;

    if (settings.mode === "browser") return;

    // ── Load platform credentials (only DB query this provider makes) ────────
    const source = rule.platform_integration_id
      ? await loadSource(context.db, rule.platform_integration_id)
      : null;
    if (!source) {
      logSkipped("source not found", {
        source_id:   rule.platform_integration_id ?? undefined,
        pipeline_id: conversionEvent.crm?.pipelineId ?? "n/a",
        stage_id:    conversionEvent.crm?.stageId    ?? "n/a",
      });
      return;
    }
    // Pipeline scope guard: only enforced when the event carries CRM context
    // AND the integration is pipeline-scoped (pipeline_id != null).
    // Global integrations (pipeline_id = null) are valid for any pipeline.
    if (conversionEvent.crm && source.pipeline_id !== null && source.pipeline_id !== conversionEvent.crm.pipelineId) {
      logSkipped("source pipeline mismatch", {
        source_id:   source.id,
        pipeline_id: conversionEvent.crm.pipelineId,
        stage_id:    conversionEvent.crm.stageId,
      });
      return;
    }
    if (!source.is_active) {
      logSkipped("source inactive", {
        source_id:   source.id,
        pipeline_id: conversionEvent.crm?.pipelineId ?? "n/a",
        stage_id:    conversionEvent.crm?.stageId    ?? "n/a",
      });
      return;
    }

    const capiPayload = buildCapiPayload(source, conversionEvent, settings);
    const result      = await sendCapiRequest(capiPayload, source);
    await persistResult(context.db, source.id, result, context.now);

    if (result.shouldRetry) {
      throw new Error(result.errorMessage ?? "Meta CAPI transient failure");
    }
  },
};

registerConversionProvider(metaConversionProvider);
