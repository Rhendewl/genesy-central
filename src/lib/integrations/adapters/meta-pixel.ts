import type {
  AdapterCapabilities, AdapterPayload, DeliveryResult,
  IntegrationAdapter, IntegrationConfig, IntegrationContext,
} from "../types";
import { trackConversion } from "./fbq";
import { getMetaDeliveryMode, getMetaPixelId } from "../meta-config";

type CAPIEvent = {
  event_name:   string;
  event_id:     string;
  user_data?:   Record<string, unknown>;
  [key: string]: unknown;
};

type CAPIBody = {
  data:             CAPIEvent[];
  test_event_code?: string;
};

export class MetaPixelAdapter implements IntegrationAdapter {
  readonly name    = "meta-pixel" as const;
  readonly version = "1.1.0";
  readonly capabilities: AdapterCapabilities = {
    supportsBatch: false,
    supportsRetry: true,
    supportsOAuth: false,
    supportsHmac:  false,
    supportsAsync: true,
  };

  async execute(
    payload: AdapterPayload,
    ctx:     IntegrationContext,
    config:  IntegrationConfig,
  ): Promise<DeliveryResult> {
    const start      = Date.now();
    const mode       = getMetaDeliveryMode(config.settings);
    const pixelId    = getMetaPixelId(config.settings);
    const raw        = payload.raw as CAPIBody;
    const evt0       = raw.data?.[0];
    const eventId    = evt0?.event_id  ?? "";
    const evtName    = evt0?.event_name ?? "Lead";
    // custom_data mirrors what CAPI receives — Browser Pixel gets identical parameters
    const customData = evt0?.custom_data as Record<string, unknown> | undefined;

    // ── Browser Pixel ──────────────────────────────────────────────────────
    if (mode === "browser" || mode === "both") {
      try {
        trackConversion(pixelId, evtName, eventId, customData);
      } catch {
        // browser errors never fail the delivery record
      }
    }

    // ── Conversions API (server-side) ──────────────────────────────────────
    if (mode === "capi" || mode === "both") {
      return this.sendCapi(raw, payload, ctx, start);
    }

    // browser-only: delivery always succeeds from our side
    return {
      ok:            true,
      durationMs:    Date.now() - start,
      attempt:       ctx.attempt,
      correlationId: ctx.correlationId,
    };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async sendCapi(
    raw:     CAPIBody,
    payload: AdapterPayload,
    ctx:     IntegrationContext,
    start:   number,
  ): Promise<DeliveryResult> {
    // Clone so we don't mutate the shared payload
    const body: CAPIBody = JSON.parse(JSON.stringify(raw)) as CAPIBody;
    const evt            = body.data?.[0];

    if (evt) {
      const ud: Record<string, unknown> = evt.user_data ?? {};
      evt.user_data = ud;

      // Supplement with browser-available fields when not already present
      if (!ud.fbp)                ud.fbp                = readCookie("_fbp");
      if (!ud.fbc)                ud.fbc                = readCookie("_fbc");
      if (!ud.client_user_agent && typeof navigator !== "undefined")
        ud.client_user_agent = navigator.userAgent;

      // Remove nullish values to keep the payload clean
      for (const k of Object.keys(ud)) {
        if (ud[k] == null) delete ud[k];
      }
      if (Object.keys(ud).length === 0) delete evt.user_data;
    }

    try {
      const res = await fetch(payload.endpoint!, {
        method:  payload.method ?? "POST",
        headers: payload.headers,
        body:    JSON.stringify(body),
        signal:  ctx.signal,
      });
      let responseError: string | undefined;
      if (!res.ok && typeof res.text === "function") {
        const text = await res.text().catch(() => "");
        if (text) {
          try {
            const parsed = JSON.parse(text) as {
              error?: { message?: string; code?: number; error_subcode?: number; fbtrace_id?: string };
            };
            const metaError = parsed.error;
            if (metaError?.message) {
              const codes = [
                metaError.code != null ? `código ${metaError.code}` : null,
                metaError.error_subcode != null ? `subcódigo ${metaError.error_subcode}` : null,
                metaError.fbtrace_id ? `trace ${metaError.fbtrace_id}` : null,
              ].filter(Boolean).join(", ");
              responseError = `${metaError.message}${codes ? ` (${codes})` : ""}`;
            } else {
              responseError = text.slice(0, 800);
            }
          } catch {
            responseError = text.slice(0, 800);
          }
        }
      }
      return {
        ok:            res.ok,
        status:        res.status,
        durationMs:    Date.now() - start,
        attempt:       ctx.attempt,
        correlationId: ctx.correlationId,
        error:         res.ok ? undefined : `HTTP ${res.status}${responseError ? `: ${responseError}` : ""}`,
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

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.cookie.split("; ").find(r => r.startsWith(`${name}=`))?.split("=")[1];
}
