import type {
  AdapterCapabilities, AdapterPayload, DeliveryResult,
  IntegrationAdapter, IntegrationConfig, IntegrationContext,
} from "../types";
import { signPayload } from "../security/hmac";

export class WebhookAdapter implements IntegrationAdapter {
  readonly name    = "webhook" as const;
  readonly version = "1.0.0";
  readonly capabilities: AdapterCapabilities = {
    supportsBatch:  false,
    supportsRetry:  true,
    supportsOAuth:  false,
    supportsHmac:   true,
    supportsAsync:  true,
  };

  async execute(
    payload: AdapterPayload,
    ctx:     IntegrationContext,
    config:  IntegrationConfig,
  ): Promise<DeliveryResult> {
    const start = Date.now();
    const body  = JSON.stringify(payload.raw);
    const hdrs  = { ...(payload.headers ?? {}) };

    // HMAC-SHA256 signing when secret is configured.
    if (config.secrets.hmac_secret) {
      hdrs["X-Lancaster-Signature"] = await signPayload(body, config.secrets.hmac_secret);
    }

    try {
      const res = await fetch(payload.endpoint!, {
        method:  payload.method ?? "POST",
        headers: hdrs,
        body,
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
