import type { AdapterPayload, IntegrationConfig, IntegrationMapper, TransformedEvent } from "../types";

// Maps Lancaster bus event types to Meta Conversions API event_name values.
const EVENT_NAME: Record<string, string> = {
  "form.started":        "StartTrial",
  "form.completed":      "CompleteRegistration",
  "form.abandoned":      "CustomEvent",
  "form.step.completed": "ViewContent",
  "form.submission.succeeded": "Lead",
};

export const metaMapper: IntegrationMapper = {
  adapterName: "meta-pixel",

  map(event: TransformedEvent, config: IntegrationConfig): AdapterPayload {
    const pixelId     = config.settings.pixel_id as string;
    const accessToken = config.secrets.access_token ?? "";
    const eventName   = EVENT_NAME[event.type] ?? "CustomEvent";

    const apiEvent = {
      event_name:       eventName,
      event_time:       Math.floor(event.timestamp / 1000),
      event_id:         event.id,
      action_source:    "website",
      event_source_url: (event.meta?.page_url as string | undefined) ?? undefined,
      custom_data:      {
        form_slug:      event.formSlug,
        event_type:     event.type,
        correlation_id: event.correlationId,
      },
    };

    return {
      raw:      { data: [apiEvent] },
      method:   "POST",
      endpoint: `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`,
      headers:  { "Content-Type": "application/json" },
    };
  },
};
