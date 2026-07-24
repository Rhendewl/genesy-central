import { describe, it, expect } from "vitest";
import { INTEGRATION_CATALOG, getCatalogEntry, ALL_FORM_EVENTS } from "../catalog";

describe("INTEGRATION_CATALOG", () => {
  it("contains exactly 4 integrations", () => {
    expect(INTEGRATION_CATALOG).toHaveLength(4);
  });

  it("each definition has required fields", () => {
    for (const def of INTEGRATION_CATALOG) {
      expect(typeof def.adapterName).toBe("string");
      expect(typeof def.displayName).toBe("string");
      expect(typeof def.description).toBe("string");
      expect(typeof def.category).toBe("string");
      expect(typeof def.version).toBe("string");
      expect(Array.isArray(def.supportedEvents)).toBe(true);
      expect(Array.isArray(def.settingsSchema)).toBe(true);
      expect(Array.isArray(def.secretsSchema)).toBe(true);
    }
  });

  it("adapter names are unique", () => {
    const names = INTEGRATION_CATALOG.map(d => d.adapterName);
    expect(new Set(names).size).toBe(names.length);
  });

  it("includes meta-pixel, google-analytics, webhook, crm", () => {
    const names = INTEGRATION_CATALOG.map(d => d.adapterName);
    expect(names).toContain("meta-pixel");
    expect(names).toContain("ga4");
    expect(names).toContain("webhook");
    expect(names).toContain("crm");
  });

  it("each settings field has key, label, type, required", () => {
    for (const def of INTEGRATION_CATALOG) {
      for (const field of def.settingsSchema) {
        expect(typeof field.key).toBe("string");
        expect(typeof field.label).toBe("string");
        expect(typeof field.type).toBe("string");
        expect(typeof field.required).toBe("boolean");
      }
    }
  });

  it("webhook monitors completed submissions", () => {
    const webhook = INTEGRATION_CATALOG.find(d => d.adapterName === "webhook")!;
    expect(webhook.supportedEvents).toEqual(["form.submission.completed"]);
  });

  it("webhook has hmac authType", () => {
    const webhook = INTEGRATION_CATALOG.find(d => d.adapterName === "webhook")!;
    expect(webhook.authType).toBe("hmac");
  });
});

describe("getCatalogEntry()", () => {
  it("returns the definition for a known adapter", () => {
    const def = getCatalogEntry("meta-pixel");
    expect(def).toBeDefined();
    expect(def!.adapterName).toBe("meta-pixel");
  });

  it("returns undefined for unknown adapter", () => {
    expect(getCatalogEntry("unknown-adapter")).toBeUndefined();
  });

  it("returns correct entry for each adapter", () => {
    for (const catalog of INTEGRATION_CATALOG) {
      expect(getCatalogEntry(catalog.adapterName)).toBe(catalog);
    }
  });
});

describe("ALL_FORM_EVENTS", () => {
  it("is a non-empty array of strings", () => {
    expect(Array.isArray(ALL_FORM_EVENTS)).toBe(true);
    expect(ALL_FORM_EVENTS.length).toBeGreaterThan(0);
    for (const evt of ALL_FORM_EVENTS) expect(typeof evt).toBe("string");
  });

  it("includes form.started and form.completed", () => {
    expect(ALL_FORM_EVENTS).toContain("form.started");
    expect(ALL_FORM_EVENTS).toContain("form.completed");
  });
});
