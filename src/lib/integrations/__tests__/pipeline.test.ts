import { describe, it, expect } from "vitest";
import { createTransformPipeline } from "../pipeline/pipeline";
import { normalizeTransform }       from "../pipeline/transforms/normalize";
import { enrichTransform }          from "../pipeline/transforms/enrich";
import { maskTransform }            from "../pipeline/transforms/mask";
import { makeEvent }                from "./helpers";

const ctx = { formSlug: "my-form", correlationId: "corr-1" };

// ── createTransformPipeline ───────────────────────────────────────────────────

describe("createTransformPipeline()", () => {
  it("marks result as transformed=true", () => {
    const pipeline = createTransformPipeline([]);
    const result   = pipeline.run(makeEvent(), ctx);
    expect(result.transformed).toBe(true);
  });

  it("records applied transform names in order", () => {
    const pipeline = createTransformPipeline([normalizeTransform, enrichTransform]);
    const result   = pipeline.run(makeEvent(), ctx);
    expect(result.transforms).toEqual(["normalize", "enrich"]);
  });

  it("empty pipeline returns event unchanged (except metadata)", () => {
    const pipeline = createTransformPipeline([]);
    const event    = makeEvent("form.started");
    const result   = pipeline.run(event, ctx);
    expect(result.type).toBe("form.started");
    expect(result.id).toBe(event.id);
  });

  it("chains transforms in order", () => {
    const upper = {
      name: "upper",
      transform: (e: Parameters<typeof normalizeTransform.transform>[0]) => ({
        ...e, type: e.type.toUpperCase(),
      }),
    };
    const pipeline = createTransformPipeline([normalizeTransform, upper]);
    const result   = pipeline.run(makeEvent("form.Started"), ctx);
    expect(result.type).toBe("FORM.STARTED");
  });
});

// ── normalizeTransform ────────────────────────────────────────────────────────

describe("normalizeTransform", () => {
  it("lowercases and trims event type", () => {
    const e = makeEvent("  Form.STARTED  ");
    expect(normalizeTransform.transform(e, ctx).type).toBe("form.started");
  });

  it("sets version to 1 when undefined", () => {
    const e = { ...makeEvent(), version: undefined as unknown as number };
    expect(normalizeTransform.transform(e, ctx).version).toBe(1);
  });

  it("preserves payload when already an object", () => {
    const e = { ...makeEvent(), payload: { answer: 42 } };
    expect(normalizeTransform.transform(e, ctx).payload).toEqual({ answer: 42 });
  });

  it("fills empty meta with {}", () => {
    const e = { ...makeEvent(), meta: {} };
    expect(normalizeTransform.transform(e, ctx).meta).toEqual({});
  });
});

// ── enrichTransform ───────────────────────────────────────────────────────────

describe("enrichTransform", () => {
  it("adds enrichedAt to meta", () => {
    const result = enrichTransform.transform(makeEvent(), ctx);
    expect(typeof result.meta.enrichedAt).toBe("string");
  });

  it("propagates correlationId into meta", () => {
    const result = enrichTransform.transform(makeEvent(), { formSlug: "f", correlationId: "C123" });
    expect(result.meta.correlationId).toBe("C123");
  });

  it("adds page_url from meta.url when present", () => {
    const e      = { ...makeEvent(), meta: { url: "https://example.com" } };
    const result = enrichTransform.transform(e, ctx);
    expect(result.meta.page_url).toBe("https://example.com");
  });

  it("does not add page_url when meta.url is absent", () => {
    const result = enrichTransform.transform(makeEvent(), ctx);
    expect(result.meta).not.toHaveProperty("page_url");
  });
});

// ── maskTransform ─────────────────────────────────────────────────────────────

describe("maskTransform", () => {
  it("masks email fields", () => {
    const e      = { ...makeEvent(), payload: { email: "john@example.com" } };
    const result = maskTransform.transform(e, ctx);
    expect(result.payload.email).toMatch(/^j\*\*\*@example\.com$/);
  });

  it("masks CPF fields", () => {
    const e      = { ...makeEvent(), payload: { cpf: "123.456.789-09" } };
    const result = maskTransform.transform(e, ctx);
    expect(result.payload.cpf).toMatch(/^\*\*\*456\*\*\*09$/);
  });

  it("masks generic PII fields by key name", () => {
    const e      = { ...makeEvent(), payload: { name: "John Doe" } };
    const result = maskTransform.transform(e, ctx);
    expect(result.payload.name).not.toBe("John Doe");
    expect(typeof result.payload.name).toBe("string");
  });

  it("does NOT mask non-PII fields", () => {
    const e      = { ...makeEvent(), payload: { formSlug: "my-form", stepId: "s1" } };
    const result = maskTransform.transform(e, ctx);
    expect(result.payload.formSlug).toBe("my-form");
    expect(result.payload.stepId).toBe("s1");
  });

  it("masks nested objects recursively", () => {
    const e      = { ...makeEvent(), payload: { contact: { email: "x@y.com", id: 1 } } };
    const result = maskTransform.transform(e, ctx);
    const contact = (result.payload as Record<string, Record<string, unknown>>).contact;
    expect(contact.email).not.toBe("x@y.com");
    expect(contact.id).toBe(1);
  });

  it("handles short string PII (≤2 chars)", () => {
    const e      = { ...makeEvent(), payload: { name: "Al" } };
    const result = maskTransform.transform(e, ctx);
    expect(result.payload.name).toBe("**");
  });
});
