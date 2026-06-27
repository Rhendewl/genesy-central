import type { AdapterPayload, IntegrationConfig, IntegrationMapper, TransformedEvent } from "../types";

export const webhookMapper: IntegrationMapper = {
  adapterName: "webhook",

  map(event: TransformedEvent, config: IntegrationConfig): AdapterPayload {
    const url            = config.settings.url as string;
    const extraHeaders   = (config.settings.headers as Record<string, string> | undefined) ?? {};

    const body = {
      id:             event.id,
      correlation_id: event.correlationId,
      event_type:     event.type,
      form_slug:      event.formSlug,
      session_token:  event.sessionToken,
      timestamp:      new Date(event.timestamp).toISOString(),
      payload:        event.payload,
      meta:           event.meta,
      version:        event.version,
    };

    return {
      raw:      body,
      method:   "POST",
      endpoint: url,
      headers:  {
        "Content-Type":              "application/json",
        "X-Lancaster-Event-Id":      event.id,
        "X-Lancaster-Correlation-Id": event.correlationId,
        ...extraHeaders,
      },
    };
  },
};
