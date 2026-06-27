// Shared test helpers for the integrations layer.

import type { IntegrationConfig, TransformedEvent } from "../types";

export function makeConfig(overrides: Partial<IntegrationConfig> = {}): IntegrationConfig {
  return {
    id:          "cfg-1",
    adapterName: "webhook",
    enabled:     true,
    settings:    { url: "https://example.com/hook" },
    secrets:     {},
    eventFilter: undefined,
    retryPolicy: { maxAttempts: 1, initialDelayMs: 0, timeoutMs: 5000 },
    ...overrides,
  };
}

export function makeEvent(type = "form.started", overrides: Partial<TransformedEvent> = {}): TransformedEvent {
  return {
    id:            "evt-001",
    correlationId: "corr-abc",
    type,
    formSlug:      "my-form",
    sessionToken:  "tok-xyz",
    timestamp:     1_700_000_000_000,
    payload:       { formSlug: "my-form" },
    meta:          {},
    version:       1,
    transformed:   true,
    transforms:    ["normalize"],
    ...overrides,
  };
}

export const tick = (ms = 20) => new Promise<void>(r => setTimeout(r, ms));
