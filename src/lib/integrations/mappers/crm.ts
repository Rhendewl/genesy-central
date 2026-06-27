import type { AdapterPayload, IntegrationConfig, IntegrationMapper, TransformedEvent } from "../types";

export const crmMapper: IntegrationMapper = {
  adapterName: "crm",

  map(event: TransformedEvent, config: IntegrationConfig): AdapterPayload {
    const url      = config.settings.url as string;
    const fieldMap = (config.settings.fieldMap as Record<string, string> | undefined) ?? {};
    const apiKey   = config.secrets.api_key ?? "";

    const sourcePayload = event.payload as Record<string, unknown>;

    // Apply field mapping: rename source keys to target CRM field names.
    const mapped: Record<string, unknown> = {};
    const usedSourceKeys = new Set<string>();

    for (const [sourceKey, targetKey] of Object.entries(fieldMap)) {
      if (sourceKey in sourcePayload) {
        mapped[targetKey] = sourcePayload[sourceKey];
        usedSourceKeys.add(sourceKey);
      }
    }

    // Pass through unmapped fields as-is.
    for (const [key, value] of Object.entries(sourcePayload)) {
      if (!usedSourceKeys.has(key)) mapped[key] = value;
    }

    const body = {
      form_slug:      event.formSlug,
      session_token:  event.sessionToken,
      correlation_id: event.correlationId,
      event_type:     event.type,
      data:           mapped,
    };

    return {
      raw:      body,
      method:   "POST",
      endpoint: url,
      headers:  {
        "Content-Type": "application/json",
        "X-Api-Key":    apiKey,
      },
    };
  },
};
