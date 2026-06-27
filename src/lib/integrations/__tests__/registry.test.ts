import { describe, it, expect } from "vitest";
import { IntegrationRegistry } from "../registry";
import { MetaPixelAdapter }    from "../adapters/meta-pixel";
import { metaMapper }          from "../mappers/meta";
import { WebhookAdapter }      from "../adapters/webhook";
import { webhookMapper }       from "../mappers/webhook";

describe("IntegrationRegistry", () => {
  it("registers an adapter + mapper pair", () => {
    const reg = new IntegrationRegistry();
    reg.register(new MetaPixelAdapter(), metaMapper);
    expect(reg.has("meta-pixel")).toBe(true);
    expect(reg.getAdapter("meta-pixel")).toBeInstanceOf(MetaPixelAdapter);
    expect(reg.getMapper("meta-pixel")).toBe(metaMapper);
  });

  it("names() returns all registered adapter names", () => {
    const reg = new IntegrationRegistry();
    reg.register(new MetaPixelAdapter(), metaMapper);
    reg.register(new WebhookAdapter(), webhookMapper);
    expect(reg.names().sort()).toEqual(["meta-pixel", "webhook"]);
  });

  it("getAdapter() returns undefined for unknown name", () => {
    const reg = new IntegrationRegistry();
    expect(reg.getAdapter("unknown")).toBeUndefined();
  });

  it("getMapper() returns undefined for unknown name", () => {
    const reg = new IntegrationRegistry();
    expect(reg.getMapper("unknown")).toBeUndefined();
  });

  it("throws when adapter name and mapper adapterName mismatch", () => {
    const reg = new IntegrationRegistry();
    expect(() => reg.register(new MetaPixelAdapter(), webhookMapper)).toThrow(/mismatch/);
  });

  it("has() returns false for unregistered adapters", () => {
    const reg = new IntegrationRegistry();
    expect(reg.has("ga4")).toBe(false);
  });
});
