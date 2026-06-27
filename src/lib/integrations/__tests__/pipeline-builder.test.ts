import { describe, it, expect } from "vitest";
import { PipelineBuilder } from "../pipeline/builder";
import { normalizeTransform } from "../pipeline/transforms/normalize";
import { enrichTransform }    from "../pipeline/transforms/enrich";
import { maskTransform }      from "../pipeline/transforms/mask";
import { makeEvent } from "./helpers";

const ctx = { formSlug: "test", correlationId: "corr-1" };

describe("PipelineBuilder", () => {
  it("builds an empty pipeline that marks result as transformed", () => {
    const pipeline = new PipelineBuilder().build();
    expect(pipeline.run(makeEvent(), ctx).transformed).toBe(true);
  });

  it("chains transforms in use() order", () => {
    const pipeline = new PipelineBuilder()
      .use(normalizeTransform)
      .use(enrichTransform)
      .build();
    const result = pipeline.run(makeEvent(), ctx);
    expect(result.transforms).toEqual(["normalize", "enrich"]);
  });

  it("use() is chainable (returns this)", () => {
    const builder = new PipelineBuilder();
    const returned = builder.use(normalizeTransform);
    expect(returned).toBe(builder);
  });

  it("build() returns a fresh snapshot — subsequent use() does not affect prior builds", () => {
    const builder   = new PipelineBuilder().use(normalizeTransform);
    const pipeline1 = builder.build();
    builder.use(enrichTransform);       // added after first build
    const pipeline2 = builder.build();

    const r1 = pipeline1.run(makeEvent(), ctx);
    const r2 = pipeline2.run(makeEvent(), ctx);
    expect(r1.transforms).toEqual(["normalize"]);
    expect(r2.transforms).toEqual(["normalize", "enrich"]);
  });

  it("can compose normalize + enrich + mask transforms", () => {
    const pipeline = new PipelineBuilder()
      .use(normalizeTransform)
      .use(enrichTransform)
      .use(maskTransform)
      .build();
    const event  = { ...makeEvent("  Form.STARTED  "), payload: { email: "x@y.com" } };
    const result = pipeline.run(event, ctx);
    expect(result.type).toBe("form.started");
    expect(result.meta).toHaveProperty("enrichedAt");
    expect((result.payload as Record<string, string>).email).not.toBe("x@y.com");
  });
});
