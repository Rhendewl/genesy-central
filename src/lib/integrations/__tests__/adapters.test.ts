import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MetaPixelAdapter }       from "../adapters/meta-pixel";
import { GoogleAnalyticsAdapter } from "../adapters/google-analytics";
import { WebhookAdapter }         from "../adapters/webhook";
import { CRMAdapter }             from "../adapters/crm";
import type { AdapterPayload, IntegrationContext } from "../types";
import { makeConfig }  from "./helpers";
import { verifyPayload } from "../security/hmac";

// ── Shared helpers ─────────────────────────────────────────────────────────────

function makeCtx(attempt = 1): IntegrationContext {
  const ctrl = new AbortController();
  return {
    deliveryId:    "del-1",
    correlationId: "corr-1",
    attempt,
    maxAttempts:   3,
    timeoutMs:     5000,
    signal:        ctrl.signal,
  };
}

function makePayload(overrides: Partial<AdapterPayload> = {}): AdapterPayload {
  return {
    raw:      { event: "test" },
    endpoint: "https://example.com/endpoint",
    method:   "POST",
    headers:  { "Content-Type": "application/json" },
    ...overrides,
  };
}

function mockFetch(status: number, ok = status >= 200 && status < 300) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok, status,
  } as Response);
}

afterEach(() => vi.restoreAllMocks());

// ── MetaPixelAdapter ──────────────────────────────────────────────────────────

describe("MetaPixelAdapter", () => {
  const adapter = new MetaPixelAdapter();

  it("name is 'meta-pixel'", () => { expect(adapter.name).toBe("meta-pixel"); });
  it("version is defined",   () => { expect(adapter.version).toBeTruthy(); });

  it("capabilities: supportsRetry=true, supportsHmac=false", () => {
    expect(adapter.capabilities.supportsRetry).toBe(true);
    expect(adapter.capabilities.supportsHmac).toBe(false);
    expect(adapter.capabilities.supportsBatch).toBe(false);
  });

  it("returns ok=true on HTTP 200", async () => {
    mockFetch(200);
    const result = await adapter.execute(makePayload(), makeCtx(), makeConfig({ adapterName: "meta-pixel" }));
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.correlationId).toBe("corr-1");
  });

  it("returns ok=false on HTTP 500", async () => {
    mockFetch(500, false);
    const result = await adapter.execute(makePayload(), makeCtx(), makeConfig({ adapterName: "meta-pixel" }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("500");
  });

  it("includes attempt number in result", async () => {
    mockFetch(200);
    const result = await adapter.execute(makePayload(), makeCtx(2), makeConfig({ adapterName: "meta-pixel" }));
    expect(result.attempt).toBe(2);
  });

  it("sends JSON body to fetch", async () => {
    const spy = mockFetch(200);
    await adapter.execute(makePayload({ raw: { hello: "world" } }), makeCtx(), makeConfig({ adapterName: "meta-pixel" }));
    const [, init] = spy.mock.calls[0];
    expect(init?.body).toBe(JSON.stringify({ hello: "world" }));
  });
});

// ── GoogleAnalyticsAdapter ────────────────────────────────────────────────────

describe("GoogleAnalyticsAdapter", () => {
  const adapter = new GoogleAnalyticsAdapter();

  it("name is 'ga4'", () => { expect(adapter.name).toBe("ga4"); });

  it("capabilities: supportsBatch=true", () => {
    expect(adapter.capabilities.supportsBatch).toBe(true);
  });

  it("returns ok=true for HTTP 204 (GA4 standard)", async () => {
    mockFetch(204, true);
    const result = await adapter.execute(makePayload(), makeCtx(), makeConfig({ adapterName: "ga4" }));
    expect(result.ok).toBe(true);
  });

  it("returns ok=false on HTTP 400", async () => {
    mockFetch(400, false);
    const result = await adapter.execute(makePayload(), makeCtx(), makeConfig({ adapterName: "ga4" }));
    expect(result.ok).toBe(false);
  });
});

// ── WebhookAdapter ────────────────────────────────────────────────────────────

describe("WebhookAdapter", () => {
  const adapter = new WebhookAdapter();

  it("name is 'webhook'", () => { expect(adapter.name).toBe("webhook"); });

  it("capabilities: supportsHmac=true, supportsRetry=true", () => {
    expect(adapter.capabilities.supportsHmac).toBe(true);
    expect(adapter.capabilities.supportsRetry).toBe(true);
  });

  it("sends request without HMAC header when no hmac_secret", async () => {
    const spy    = mockFetch(200);
    const config = makeConfig({ adapterName: "webhook", secrets: {} });
    await adapter.execute(makePayload(), makeCtx(), config);
    const [, init] = spy.mock.calls[0];
    const headers  = init?.headers as Record<string, string>;
    expect(headers["X-Lancaster-Signature"]).toBeUndefined();
  });

  it("adds HMAC signature header when hmac_secret is set", async () => {
    const spy    = mockFetch(200);
    const config = makeConfig({ adapterName: "webhook", secrets: { hmac_secret: "my-secret" } });
    const payload = makePayload({ raw: { event: "form.started" } });
    await adapter.execute(payload, makeCtx(), config);
    const [, init] = spy.mock.calls[0];
    const headers  = init?.headers as Record<string, string>;
    const sig      = headers["X-Lancaster-Signature"];
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);

    // Verify the signature matches the body
    const body = JSON.stringify(payload.raw);
    expect(await verifyPayload(body, "my-secret", sig)).toBe(true);
  });

  it("returns ok=false on HTTP 503", async () => {
    mockFetch(503, false);
    const result = await adapter.execute(makePayload(), makeCtx(), makeConfig({ adapterName: "webhook" }));
    expect(result.ok).toBe(false);
  });
});

// ── CRMAdapter ────────────────────────────────────────────────────────────────

describe("CRMAdapter", () => {
  const adapter = new CRMAdapter();

  it("name is 'crm'", () => { expect(adapter.name).toBe("crm"); });

  it("capabilities: supportsOAuth=true", () => {
    expect(adapter.capabilities.supportsOAuth).toBe(true);
  });

  it("returns ok=true on HTTP 201", async () => {
    mockFetch(201, true);
    const result = await adapter.execute(makePayload(), makeCtx(), makeConfig({ adapterName: "crm" }));
    expect(result.ok).toBe(true);
  });

  it("returns ok=false on HTTP 401", async () => {
    mockFetch(401, false);
    const result = await adapter.execute(makePayload(), makeCtx(), makeConfig({ adapterName: "crm" }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("401");
  });
});
