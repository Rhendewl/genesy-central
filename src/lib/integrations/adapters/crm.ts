import type {
  AdapterCapabilities, AdapterPayload, DeliveryResult,
  IntegrationAdapter, IntegrationConfig, IntegrationContext,
} from "../types";

export class CRMAdapter implements IntegrationAdapter {
  readonly name    = "crm" as const;
  readonly version = "1.0.0";
  readonly capabilities: AdapterCapabilities = {
    supportsBatch:  false,
    supportsRetry:  true,
    supportsOAuth:  true,
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
      return {
        ok:            res.ok,
        status:        res.status,
        durationMs:    Date.now() - start,
        attempt:       ctx.attempt,
        correlationId: ctx.correlationId,
        error:         res.ok ? undefined : `HTTP ${res.status}`,
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
