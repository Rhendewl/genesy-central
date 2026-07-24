import { describe, it, expect } from "vitest";
import { metaMapper }            from "../mappers/meta";
import { googleAnalyticsMapper } from "../mappers/google-analytics";
import { webhookMapper }         from "../mappers/webhook";
import { crmMapper }             from "../mappers/crm";
import { makeConfig, makeEvent } from "./helpers";

// ── MetaMapper ────────────────────────────────────────────────────────────────

describe("metaMapper", () => {
  const config = makeConfig({
    adapterName: "meta-pixel",
    settings:    { pixel_id: "123456" },
    secrets:     { access_token: "tok-abc" },
  });

  it("adapterName is 'meta-pixel'", () => {
    expect(metaMapper.adapterName).toBe("meta-pixel");
  });

  it("builds Meta Conversions API endpoint with pixel_id and access_token", () => {
    const payload = metaMapper.map(makeEvent("form.started"), config);
    expect(payload.endpoint).toContain("123456");
    expect(payload.endpoint).toContain("tok-abc");
  });

  it("accepts the pixelId key used by the configuration screen", () => {
    const payload = metaMapper.map(makeEvent(), makeConfig({
      adapterName: "meta-pixel",
      settings: { pixelId: "pixel-camel-case" },
      secrets: { access_token: "token" },
    }));
    expect(payload.endpoint).toContain("pixel-camel-case");
  });

  it("maps form.started → StartTrial", () => {
    const payload = metaMapper.map(makeEvent("form.started"), config);
    const data    = (payload.raw as { data: Array<{ event_name: string }> }).data;
    expect(data[0].event_name).toBe("StartTrial");
  });

  it("maps form.completed → CompleteRegistration", () => {
    const payload = metaMapper.map(makeEvent("form.completed"), config);
    const data    = (payload.raw as { data: Array<{ event_name: string }> }).data;
    expect(data[0].event_name).toBe("CompleteRegistration");
  });

  it("always maps the dedicated phone event to Lead", () => {
    const payload = metaMapper.map(makeEvent("form.phone.answered"), makeConfig({
      adapterName: "meta-pixel",
      settings: { pixel_id: "123456", event: "Purchase" },
      secrets: { access_token: "token" },
    }));
    const data = (payload.raw as { data: Array<{ event_name: string }> }).data;
    expect(data[0].event_name).toBe("Lead");
  });

  it("maps unknown event type → CustomEvent", () => {
    const payload = metaMapper.map(makeEvent("form.unknown.xyz"), config);
    const data    = (payload.raw as { data: Array<{ event_name: string }> }).data;
    expect(data[0].event_name).toBe("CustomEvent");
  });

  it("includes event.id as event_id for deduplication", () => {
    const event   = makeEvent("form.started", { id: "my-unique-id" });
    const payload = metaMapper.map(event, config);
    const data    = (payload.raw as { data: Array<{ event_id: string }> }).data;
    expect(data[0].event_id).toBe("my-unique-id");
  });

  it("includes correlationId in custom_data", () => {
    const event   = makeEvent("form.started", { correlationId: "CORR-789" });
    const payload = metaMapper.map(event, config);
    const raw     = payload.raw as { data: Array<{ custom_data: { correlation_id: string } }> };
    expect(raw.data[0].custom_data.correlation_id).toBe("CORR-789");
  });

  it("includes page_url from meta.page_url when present", () => {
    const event   = makeEvent("form.started", { meta: { page_url: "https://example.com" } });
    const payload = metaMapper.map(event, config);
    const raw     = payload.raw as { data: Array<{ event_source_url?: string }> };
    expect(raw.data[0].event_source_url).toBe("https://example.com");
  });

  it("method is POST", () => {
    expect(metaMapper.map(makeEvent(), config).method).toBe("POST");
  });
});

// ── GoogleAnalyticsMapper ─────────────────────────────────────────────────────

describe("googleAnalyticsMapper", () => {
  const config = makeConfig({
    adapterName: "ga4",
    settings:    { measurement_id: "G-XXXXX" },
    secrets:     { api_secret: "secret-ga4" },
  });

  it("adapterName is 'ga4'", () => {
    expect(googleAnalyticsMapper.adapterName).toBe("ga4");
  });

  it("builds GA4 Measurement Protocol endpoint", () => {
    const payload = googleAnalyticsMapper.map(makeEvent("form.started"), config);
    expect(payload.endpoint).toContain("G-XXXXX");
    expect(payload.endpoint).toContain("secret-ga4");
    expect(payload.endpoint).toContain("google-analytics.com");
  });

  it("maps form.started → begin_checkout", () => {
    const payload = googleAnalyticsMapper.map(makeEvent("form.started"), config);
    const raw     = payload.raw as { events: Array<{ name: string }> };
    expect(raw.events[0].name).toBe("begin_checkout");
  });

  it("maps form.completed → purchase", () => {
    const payload = googleAnalyticsMapper.map(makeEvent("form.completed"), config);
    const raw     = payload.raw as { events: Array<{ name: string }> };
    expect(raw.events[0].name).toBe("purchase");
  });

  it("uses sessionToken as client_id", () => {
    const event   = makeEvent("form.started", { sessionToken: "session-xyz" });
    const payload = googleAnalyticsMapper.map(event, config);
    const raw     = payload.raw as { client_id: string };
    expect(raw.client_id).toBe("session-xyz");
  });

  it("includes correlationId in event params", () => {
    const event   = makeEvent("form.started", { correlationId: "C-123" });
    const payload = googleAnalyticsMapper.map(event, config);
    const raw     = payload.raw as { events: Array<{ params: { correlation_id: string } }> };
    expect(raw.events[0].params.correlation_id).toBe("C-123");
  });

  it("converts dots to underscores for unmapped event types", () => {
    const payload = googleAnalyticsMapper.map(makeEvent("custom.event.type"), config);
    const raw     = payload.raw as { events: Array<{ name: string }> };
    expect(raw.events[0].name).toBe("custom_event_type");
  });
});

// ── WebhookMapper ─────────────────────────────────────────────────────────────

describe("webhookMapper", () => {
  const config = makeConfig({
    adapterName: "webhook",
    settings:    { url: "https://hook.example.com/receive" },
    secrets:     {},
  });

  it("adapterName is 'webhook'", () => {
    expect(webhookMapper.adapterName).toBe("webhook");
  });

  it("uses url from settings as endpoint", () => {
    const payload = webhookMapper.map(makeEvent(), config);
    expect(payload.endpoint).toBe("https://hook.example.com/receive");
  });

  it("includes event.id in body", () => {
    const event   = makeEvent("form.started", { id: "evt-777" });
    const payload = webhookMapper.map(event, config);
    const raw     = payload.raw as { id: string };
    expect(raw.id).toBe("evt-777");
  });

  it("includes correlationId in body", () => {
    const event   = makeEvent("form.started", { correlationId: "C-XYZ" });
    const payload = webhookMapper.map(event, config);
    const raw     = payload.raw as { correlation_id: string };
    expect(raw.correlation_id).toBe("C-XYZ");
  });

  it("adds X-Lancaster-Event-Id header", () => {
    const event   = makeEvent("form.started", { id: "evt-999" });
    const payload = webhookMapper.map(event, config);
    expect(payload.headers?.["X-Lancaster-Event-Id"]).toBe("evt-999");
  });

  it("adds X-Lancaster-Correlation-Id header", () => {
    const event   = makeEvent("form.started", { correlationId: "CORR-1" });
    const payload = webhookMapper.map(event, config);
    expect(payload.headers?.["X-Lancaster-Correlation-Id"]).toBe("CORR-1");
  });

  it("merges extra headers from settings", () => {
    const cfg     = makeConfig({ adapterName: "webhook", settings: { url: "https://x.com", headers: { "X-Custom": "value" } } });
    const payload = webhookMapper.map(makeEvent(), cfg);
    expect(payload.headers?.["X-Custom"]).toBe("value");
  });

  it("timestamp is ISO string", () => {
    const payload = webhookMapper.map(makeEvent(), config);
    const raw     = payload.raw as { timestamp: string };
    expect(() => new Date(raw.timestamp)).not.toThrow();
  });
});

// ── CRMMapper ─────────────────────────────────────────────────────────────────

describe("crmMapper", () => {
  const config = makeConfig({
    adapterName: "crm",
    settings:    { url: "https://crm.example.com/leads", fieldMap: { fullName: "name", userEmail: "email" } },
    secrets:     { api_key: "crm-key-123" },
  });

  it("adapterName is 'crm'", () => {
    expect(crmMapper.adapterName).toBe("crm");
  });

  it("applies field mapping from config.settings.fieldMap", () => {
    const event   = makeEvent("form.completed", { payload: { fullName: "John", userEmail: "j@x.com" } });
    const payload = crmMapper.map(event, config);
    const raw     = payload.raw as { data: Record<string, unknown> };
    expect(raw.data.name).toBe("John");
    expect(raw.data.email).toBe("j@x.com");
    expect(raw.data.fullName).toBeUndefined();
  });

  it("passes through unmapped payload fields", () => {
    const event   = makeEvent("form.completed", { payload: { score: 42, formSlug: "f" } });
    const payload = crmMapper.map(event, config);
    const raw     = payload.raw as { data: Record<string, unknown> };
    expect(raw.data.score).toBe(42);
  });

  it("uses api_key in X-Api-Key header", () => {
    const payload = crmMapper.map(makeEvent(), config);
    expect(payload.headers?.["X-Api-Key"]).toBe("crm-key-123");
  });

  it("includes correlationId in body", () => {
    const event   = makeEvent("form.completed", { correlationId: "C-99" });
    const payload = crmMapper.map(event, config);
    const raw     = payload.raw as { correlation_id: string };
    expect(raw.correlation_id).toBe("C-99");
  });

  it("handles empty fieldMap (passes all fields through)", () => {
    const cfg     = makeConfig({ adapterName: "crm", settings: { url: "https://x.com" }, secrets: {} });
    const event   = makeEvent("form.completed", { payload: { a: 1, b: 2 } });
    const payload = crmMapper.map(event, cfg);
    const raw     = payload.raw as { data: Record<string, unknown> };
    expect(raw.data.a).toBe(1);
    expect(raw.data.b).toBe(2);
  });
});
