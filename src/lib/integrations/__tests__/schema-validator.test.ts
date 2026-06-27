import { describe, it, expect } from "vitest";
import { NoopSchemaValidator } from "../schema-validator";
import { makeEvent, makeConfig } from "./helpers";

describe("NoopSchemaValidator", () => {
  const validator = new NoopSchemaValidator();

  it("always returns true", () => {
    expect(validator.validate(makeEvent(), makeConfig())).toBe(true);
  });

  it("returns true regardless of event type", () => {
    expect(validator.validate(makeEvent("form.completed"), makeConfig())).toBe(true);
  });

  it("returns true for any config", () => {
    expect(validator.validate(makeEvent(), makeConfig({ adapterName: "meta-pixel" }))).toBe(true);
  });

  it("implements SchemaValidator interface (sync)", () => {
    const result = validator.validate(makeEvent(), makeConfig());
    expect(typeof result).toBe("boolean");
  });
});
