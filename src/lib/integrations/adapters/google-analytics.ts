import type {
  AdapterCapabilities, AdapterPayload, DeliveryResult,
  IntegrationAdapter, IntegrationConfig, IntegrationContext,
} from "../types";

export class GoogleAnalyticsAdapter implements IntegrationAdapter {
  readonly name    = "ga4" as const;
  readonly version = "1.0.0";
  readonly capabilities: AdapterCapabilities = {
    supportsBatch:  true,
    supportsRetry:  true,
    supportsOAuth:  false,
    supportsHmac:   false,
    supportsAsync:  true,
  };

  async execute(
    payload: AdapterPayload,
    ctx:     IntegrationContext,
    _config: IntegrationConfig,
  ): Promise<DeliveryResult> {
    const start = Date.now();
    try {
      const res = await fetch(payload.endpoint!, {
        method:  payload.method ?? "POST",
        headers: payload.headers,
        body:    JSON.stringify(payload.raw),
        signal:  ctx.signal,
      });
      // GA4 Measurement Protocol always returns 204 — treat any 2xx as ok.
      const ok = res.status >= 200 && res.status < 300;
      return {
        ok,
        status:        res.status,
        durationMs:    Date.now() - start,
        attempt:       ctx.attempt,
        correlationId: ctx.correlationId,
        error:         ok ? undefined : `HTTP ${res.status}`,
      };
    } catch (err) {
      /* v8 ignore next 6 */
      return {
        ok:            false,
        durationMs:    Date.now() - start,
        attempt:       ctx.attempt,
        correlationId: ctx.correlationId,
        error:         err instanceof Error ? err.message : "network error",
      };
    }
  }
}
