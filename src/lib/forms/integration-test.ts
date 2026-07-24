import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { getIntegrationRuntime } from "@/lib/integrations/runtime";
import type { IntegrationConfig, IntegrationContext } from "@/lib/integrations/types";

function normalizeSettings(adapter: string, value: unknown): Record<string, unknown> {
  const settings = value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};

  if (adapter === "meta-pixel") {
    settings.pixel_id ??= settings.pixelId;
  }
  if (adapter === "ga4") {
    settings.measurement_id ??= settings.measurementId;
  }
  return settings;
}

function maskedPayload(payload: { raw: unknown; method?: string; endpoint?: string; headers?: Record<string, string> }) {
  let endpoint = payload.endpoint;
  if (endpoint) {
    try {
      const url = new URL(endpoint);
      for (const key of ["access_token", "api_secret", "key", "token"]) {
        if (url.searchParams.has(key)) url.searchParams.set(key, "__masked__");
      }
      endpoint = url.toString();
    } catch {
      endpoint = "Endpoint inválido";
    }
  }

  const headers = Object.fromEntries(Object.entries(payload.headers ?? {}).map(([key, value]) => [
    key,
    /authorization|api[-_]?key|token|secret/i.test(key) ? "__masked__" : value,
  ]));

  return { raw: payload.raw, method: payload.method, endpoint, headers };
}

export async function testServerIntegration(db: SupabaseClient, formId: string, integrationId: string) {
  const [{ data: integration }, { data: form }] = await Promise.all([
    db.from("form_integrations")
      .select("id, form_id, adapter, enabled, settings, secrets, event_filter, retry_policy, rate_limit")
      .eq("id", integrationId)
      .eq("form_id", formId)
      .single(),
    db.from("forms").select("id, name, slug").eq("id", formId).single(),
  ]);
  if (!integration || !form) throw new Error("Integração não encontrada");

  const settings = normalizeSettings(integration.adapter, integration.settings);
  const secrets = (integration.secrets ?? {}) as Record<string, string>;
  if (integration.adapter === "meta-pixel") {
    if (!settings.pixel_id) throw new Error("Pixel ID não configurado");
    if (!secrets.access_token) throw new Error("Access Token da Meta não configurado");
  }
  if (integration.adapter === "ga4") {
    if (!settings.measurement_id) throw new Error("Measurement ID não configurado");
    if (!secrets.api_secret) throw new Error("API Secret do GA4 não configurado");
  }

  const runtime = getIntegrationRuntime();
  const correlationId = `test-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const testPayload: Record<string, unknown> = { formName: form.name, _test: true };
  if (integration.adapter === "meta-pixel") {
    testPayload.user_data = {
      em: [createHash("sha256").update("integration-test@genesy.local").digest("hex")],
      client_user_agent: "Genesy Integration Test/1.0",
    };
  }
  const event = runtime.pipeline.run({
    id: `test-evt-${Date.now()}`,
    correlationId,
    type: "form.started",
    formSlug: form.slug ?? form.id,
    sessionToken: "test-session",
    timestamp: Date.now(),
    payload: testPayload,
    meta: { page_url: `https://dash.genesycompany.com/form/${form.slug ?? form.id}` },
    version: 1,
  }, { formSlug: form.slug ?? form.id, correlationId });

  const config: IntegrationConfig = {
    id: integration.id,
    adapterName: integration.adapter,
    enabled: integration.enabled,
    settings,
    secrets,
    eventFilter: integration.event_filter ?? undefined,
    retryPolicy: integration.retry_policy ?? undefined,
    rateLimit: integration.rate_limit ?? undefined,
  };
  const mapper = runtime.registry.getMapper(integration.adapter);
  const adapter = runtime.registry.getAdapter(integration.adapter);
  if (!mapper || !adapter) throw new Error("Adapter não disponível para teste");

  const payload = mapper.map(event, config);
  const controller = new AbortController();
  const timeoutMs = 15_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const context: IntegrationContext = {
    deliveryId: `test-delivery-${crypto.randomUUID()}`,
    correlationId,
    attempt: 1,
    maxAttempts: 1,
    timeoutMs,
    signal: controller.signal,
  };

  try {
    const result = await adapter.execute(payload, context, config);
    return {
      ok: result.ok,
      statusCode: result.status,
      durationMs: result.durationMs,
      error: result.error,
      payloadSent: JSON.stringify(maskedPayload(payload), null, 2),
      correlationId,
    };
  } finally {
    clearTimeout(timer);
  }
}
