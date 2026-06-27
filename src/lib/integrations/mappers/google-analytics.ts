import type { AdapterPayload, IntegrationConfig, IntegrationMapper, TransformedEvent } from "../types";

// Maps Lancaster bus events to GA4 Measurement Protocol event names.
const EVENT_NAME: Record<string, string> = {
  "form.loaded":         "page_view",
  "form.started":        "begin_checkout",
  "form.completed":      "purchase",
  "form.abandoned":      "form_abandon",
  "form.step.viewed":    "view_item",
  "form.step.completed": "add_to_cart",
  "form.welcome.viewed": "welcome_view",
  "form.submission.succeeded": "conversion",
};

export const googleAnalyticsMapper: IntegrationMapper = {
  adapterName: "ga4",

  map(event: TransformedEvent, config: IntegrationConfig): AdapterPayload {
    const measurementId = config.settings.measurement_id as string;
    const apiSecret     = config.secrets.api_secret ?? "";
    const eventName     = EVENT_NAME[event.type] ?? event.type.replace(/[.\-\s]/g, "_");
    const payload       = event.payload as Record<string, unknown>;

    const body = {
      client_id: event.sessionToken || "anonymous",
      events: [{
        name:   eventName,
        params: {
          form_slug:            event.formSlug,
          event_type:           event.type,
          correlation_id:       event.correlationId,
          engagement_time_msec: 1,
          ...(payload.stepId  ? { step_id:    payload.stepId    } : {}),
          ...(payload.stepIndex !== undefined ? { step_index: payload.stepIndex } : {}),
        },
      }],
    };

    return {
      raw:      body,
      method:   "POST",
      endpoint: `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      headers:  { "Content-Type": "application/json" },
    };
  },
};
