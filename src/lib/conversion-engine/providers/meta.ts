import { registerConversionProvider, type ConversionProvider, type ProviderContext } from "../registry";
import type { LeadStageEnteredPayload } from "@/lib/event-bus/domain-events";
import type { CrmConversionSource, CrmStageConversion, MetaPixelConversionSettings } from "@/types/crm";
import { hashEmail, hashFirstName, hashLastName, hashPhone } from "../utils/hash";

// ─────────────────────────────────────────────────────────────────────────────
// Meta Pixel / Conversions API provider
//
// Orchestrator: resolves the conversion source + lead, builds the CAPI
// payload, sends it to Meta, and persists the result. Heavy lifting (hashing)
// lives in utils/hash.ts so it can be reused by future providers (Google
// Enhanced Conversions uses the same em/ph/fn/ln hashing scheme).
// ─────────────────────────────────────────────────────────────────────────────

const META_GRAPH_VERSION = "v20.0";
const CAPI_TIMEOUT_MS    = 8_000;

// HTTP statuses worth retrying via the EventBus — everything else (4xx) is a
// permanent failure (bad token, bad pixel, malformed payload) and retrying
// would just repeat the same outcome.
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

type SourceRow = Pick<CrmConversionSource, "id" | "pixel_id" | "access_token" | "test_event_code" | "is_active" | "pipeline_id">;

type LeadRow = {
  id:            string;
  name:          string;
  contact:       string;
  email:         string | null;
  source:        string;
  campaign_name: string | null;
  ad_name:       string | null;
  deal_value:    number;
};

type SendResult = {
  ok:            boolean;
  statusCode?:   number;
  errorMessage?: string;
  shouldRetry:   boolean;
};

async function loadSource(db: ProviderContext["db"], sourceId: string): Promise<SourceRow | null> {
  const { data } = await db
    .from("crm_conversion_sources")
    .select("id, pixel_id, access_token, test_event_code, is_active, pipeline_id")
    .eq("id", sourceId)
    .maybeSingle();
  return data ?? null;
}

async function loadLead(db: ProviderContext["db"], leadId: string): Promise<LeadRow | null> {
  const { data } = await db
    .from("leads")
    .select("id, name, contact, email, source, campaign_name, ad_name, deal_value")
    .eq("id", leadId)
    .maybeSingle();
  return data ?? null;
}

function buildCapiPayload(
  source:         SourceRow,
  lead:           LeadRow,
  eventId:        string,
  eventTimestamp: number,
  payload:        LeadStageEnteredPayload,
  settings:       MetaPixelConversionSettings,
) {
  const userData: Record<string, string> = {};
  if (lead.email) userData.em = hashEmail(lead.email);
  const ph = lead.contact ? hashPhone(lead.contact) : null;
  if (ph) userData.ph = ph;
  if (lead.name) {
    userData.fn = hashFirstName(lead.name);
    const ln = hashLastName(lead.name);
    if (ln) userData.ln = ln;
  }

  const customData: Record<string, unknown> = {
    lead_id:     payload.leadId,
    pipeline_id: payload.pipelineId,
    stage_id:    payload.stageId,
  };
  if (lead.source)        customData.lead_source   = lead.source;
  if (lead.campaign_name) customData.campaign_name = lead.campaign_name;
  if (lead.ad_name)       customData.ad_name       = lead.ad_name;

  const value = settings.value ?? (lead.deal_value > 0 ? lead.deal_value : null);
  if (value != null) {
    customData.value    = value;
    customData.currency = settings.currency ?? "BRL";
  }

  const eventName = settings.event_name === "CustomEvent" && settings.custom_event_name
    ? settings.custom_event_name
    : settings.event_name;

  return {
    data: [{
      event_name:    eventName,
      event_time:    Math.floor(eventTimestamp / 1000),
      event_id:      eventId,
      action_source: "other" as const,
      user_data:     userData,
      custom_data:   customData,
    }],
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
    // Network failure or AbortSignal timeout — both transient.
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
  // FUTURE: crm_conversion_sources pode receber `last_error_code` (HTTP
  // status retornado pela Meta) para diagnóstico mais granular. Quando essa
  // coluna existir, persistir result.statusCode aqui também.
  const update = result.ok
    ? { last_success_at: now.toISOString(), last_error: null, last_error_at: null }
    : { last_error: result.errorMessage ?? "unknown error", last_error_at: now.toISOString() };

  const { error } = await db.from("crm_conversion_sources").update(update).eq("id", sourceId);
  if (error) console.warn("[conversion-engine] failed to persist meta result", { sourceId, error: error.message });
}

function logSkipped(
  reason: "source not found" | "source inactive" | "source pipeline mismatch" | "lead not found",
  ctx:    { source_id?: string; lead_id?: string; pipeline_id: string; stage_id: string },
): void {
  console.warn("[conversion-engine] dispatch skipped", { provider: "meta_pixel", reason, ...ctx });
}

export const metaConversionProvider: ConversionProvider = {
  platform: "meta_pixel",
  async execute(conversion: CrmStageConversion, event, context: ProviderContext) {
    const payload  = event.payload as LeadStageEnteredPayload;
    const settings = conversion.settings as unknown as MetaPixelConversionSettings;

    // Browser-only mode has no server-side action — the fbq pixel on the page
    // (not the CRM) is responsible for firing this event.
    if (settings.mode === "browser") return;

    const source = await loadSource(context.db, settings.pixel_integration_id);
    if (!source) {
      logSkipped("source not found", {
        source_id:   settings.pixel_integration_id,
        pipeline_id: payload.pipelineId,
        stage_id:    payload.stageId,
      });
      return;
    }
    // Defensive: never trust settings.pixel_integration_id alone — confirm
    // the resolved source actually belongs to this event's pipeline before
    // using its pixel_id/access_token.
    if (source.pipeline_id !== payload.pipelineId) {
      logSkipped("source pipeline mismatch", {
        source_id:   source.id,
        pipeline_id: payload.pipelineId,
        stage_id:    payload.stageId,
      });
      return;
    }
    if (!source.is_active) {
      logSkipped("source inactive", {
        source_id:   source.id,
        pipeline_id: payload.pipelineId,
        stage_id:    payload.stageId,
      });
      return;
    }

    const lead = await loadLead(context.db, payload.leadId);
    if (!lead) {
      logSkipped("lead not found", {
        lead_id:     payload.leadId,
        pipeline_id: payload.pipelineId,
        stage_id:    payload.stageId,
      });
      return;
    }

    const capiPayload = buildCapiPayload(source, lead, event.id, event.timestamp, payload, settings);
    const result       = await sendCapiRequest(capiPayload, source);
    await persistResult(context.db, source.id, result, context.now);

    if (result.shouldRetry) {
      throw new Error(result.errorMessage ?? "Meta CAPI transient failure");
    }
  },
};

registerConversionProvider(metaConversionProvider);
