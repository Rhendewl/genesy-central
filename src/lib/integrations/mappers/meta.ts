import type { AdapterPayload, IntegrationConfig, IntegrationMapper, TransformedEvent } from "../types";

const EVENT_NAME: Record<string, string> = {
  "form.started":              "StartTrial",
  "form.completed":            "CompleteRegistration",
  "form.abandoned":            "CustomEvent",
  "form.step.completed":       "ViewContent",
  "form.submission.succeeded": "Lead",
};

export const metaMapper: IntegrationMapper = {
  adapterName: "meta-pixel",

  map(event: TransformedEvent, config: IntegrationConfig): AdapterPayload {
    const pixelId         = config.settings.pixel_id as string;
    const accessToken     = config.secrets.access_token ?? "";
    const testEventCode   = config.settings.test_event_code as string | undefined;
    const configEventName = config.settings.event as string | undefined;
    const eventName       = configEventName || EVENT_NAME[event.type] || "CustomEvent";

    // user_data comes pre-hashed from the hook (SHA-256 via Web Crypto API)
    const ud = (event.payload.user_data as Record<string, unknown> | undefined) ?? {};

    const userDataFields: Record<string, unknown> = {};
    if (ud.em)                 userDataFields.em                 = ud.em;
    if (ud.ph)                 userDataFields.ph                 = ud.ph;
    if (ud.fn)                 userDataFields.fn                 = ud.fn;
    if (ud.ln)                 userDataFields.ln                 = ud.ln;
    if (ud.fbp)                userDataFields.fbp                = ud.fbp;
    if (ud.fbc)                userDataFields.fbc                = ud.fbc;
    if (ud.client_user_agent)  userDataFields.client_user_agent  = ud.client_user_agent;

    const apiEvent: Record<string, unknown> = {
      event_name:    eventName,
      event_time:    Math.floor(event.timestamp / 1000),
      event_id:      event.id,
      action_source: "website",
      user_data:     Object.keys(userDataFields).length > 0 ? userDataFields : undefined,
      custom_data:   {
        form_slug:      event.formSlug,
        event_type:     event.type,
        correlation_id: event.correlationId,
      },
    };

    if (event.meta?.page_url) {
      apiEvent.event_source_url = event.meta.page_url as string;
    }

    const body: Record<string, unknown> = { data: [apiEvent] };
    if (testEventCode) body.test_event_code = testEventCode;

    return {
      raw:      body,
      method:   "POST",
      endpoint: `https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`,
      headers:  { "Content-Type": "application/json" },
    };
  },
};
