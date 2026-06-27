import { describe, it, expect } from "vitest";
import { adaptLegacyRule } from "../adapters";
import type { LogicRule } from "@/types";

// ── Helper ────────────────────────────────────────────────────────────────────

function makeRule(overrides: Partial<LogicRule> = {}): LogicRule {
  return {
    id:        "rule-1",
    condition: { step: "step-1", operator: "equals", value: "yes" },
    action:    { type: "jump", target: "step-2" },
    ...overrides,
  };
}

// ── jump → jump ───────────────────────────────────────────────────────────────

describe("adaptLegacyRule() — jump action", () => {
  it('converts action type "jump" → EngineRule action type "jump"', () => {
    const adapted = adaptLegacyRule(makeRule({ action: { type: "jump", target: "step-2" } }));
    expect(adapted.action.type).toBe("jump");
  });

  it("preserves the target step ID in the adapted action", () => {
    const adapted = adaptLegacyRule(makeRule({ action: { type: "jump", target: "step-99" } }));
    if (adapted.action.type === "jump") expect(adapted.action.stepId).toBe("step-99");
  });

  it("preserves the rule ID", () => {
    const adapted = adaptLegacyRule(makeRule({ id: "my-rule-id" }));
    expect(adapted.id).toBe("my-rule-id");
  });

  it("preserves the step ID from condition.step", () => {
    const adapted = adaptLegacyRule(makeRule({ condition: { step: "q5", operator: "equals", value: "ok" } }));
    expect(adapted.stepId).toBe("q5");
  });

  it("defaults priority to 0", () => {
    const adapted = adaptLegacyRule(makeRule());
    expect(adapted.priority).toBe(0);
  });

  it("wraps the flat condition in a LeafCondition inside an AND group", () => {
    const adapted = adaptLegacyRule(makeRule({ condition: { step: "s1", operator: "equals", value: "hello" } }));
    expect(adapted.conditions.operator).toBe("AND");
    expect(adapted.conditions.items).toHaveLength(1);
  });

  it("maps operator from legacy condition to leaf condition", () => {
    const adapted = adaptLegacyRule(makeRule({ condition: { step: "s1", operator: "contains", value: "world" } }));
    const leaf    = adapted.conditions.items[0] as unknown as Record<string, unknown>;
    expect(leaf.operator).toBe("contains");
  });

  it("maps value from legacy condition to leaf condition", () => {
    const adapted = adaptLegacyRule(makeRule({ condition: { step: "s1", operator: "equals", value: "my-value" } }));
    const leaf    = adapted.conditions.items[0] as unknown as Record<string, unknown>;
    expect(leaf.value).toBe("my-value");
  });

  it("sets source to 'answers' in the leaf condition", () => {
    const adapted = adaptLegacyRule(makeRule());
    const leaf    = adapted.conditions.items[0] as unknown as Record<string, unknown>;
    expect(leaf.source).toBe("answers");
  });

  it("falls back to continue when action is jump but target is missing", () => {
    const adapted = adaptLegacyRule(makeRule({ action: { type: "jump", target: undefined } }));
    expect(adapted.action.type).toBe("continue");
  });
});

// ── end → ending ──────────────────────────────────────────────────────────────

describe("adaptLegacyRule() — end action", () => {
  it('converts action type "end" → EngineRule action type "ending"', () => {
    const adapted = adaptLegacyRule(makeRule({ action: { type: "end", target: "ending-success" } }));
    expect(adapted.action.type).toBe("ending");
  });

  it("preserves the target ending ID", () => {
    const adapted = adaptLegacyRule(makeRule({ action: { type: "end", target: "ending-success" } }));
    if (adapted.action.type === "ending") expect(adapted.action.endingId).toBe("ending-success");
  });

  it("uses 'default' as endingId when target is missing", () => {
    const adapted = adaptLegacyRule(makeRule({ action: { type: "end", target: undefined } }));
    expect(adapted.action.type).toBe("ending");
    if (adapted.action.type === "ending") expect(adapted.action.endingId).toBe("default");
  });
});

// ── disqualify → ending ───────────────────────────────────────────────────────

describe("adaptLegacyRule() — disqualify action", () => {
  it('converts action type "disqualify" → EngineRule action type "ending"', () => {
    const adapted = adaptLegacyRule(makeRule({ action: { type: "disqualify", target: "ending-rejected" } }));
    expect(adapted.action.type).toBe("ending");
  });

  it("preserves the target ending ID for disqualify", () => {
    const adapted = adaptLegacyRule(makeRule({ action: { type: "disqualify", target: "ending-rejected" } }));
    if (adapted.action.type === "ending") expect(adapted.action.endingId).toBe("ending-rejected");
  });

  it("uses 'default' as endingId when target is missing for disqualify", () => {
    const adapted = adaptLegacyRule(makeRule({ action: { type: "disqualify", target: undefined } }));
    if (adapted.action.type === "ending") expect(adapted.action.endingId).toBe("default");
  });
});

// ── redirect → redirect ───────────────────────────────────────────────────────

describe("adaptLegacyRule() — redirect action", () => {
  it('converts action type "redirect" → EngineRule action type "redirect"', () => {
    const adapted = adaptLegacyRule(makeRule({ action: { type: "redirect", url: "https://example.com" } }));
    expect(adapted.action.type).toBe("redirect");
  });

  it("preserves the target URL", () => {
    const adapted = adaptLegacyRule(makeRule({ action: { type: "redirect", url: "https://example.com/path" } }));
    if (adapted.action.type === "redirect") expect(adapted.action.url).toBe("https://example.com/path");
  });

  it("falls back to continue when url is missing in redirect action", () => {
    const adapted = adaptLegacyRule(makeRule({ action: { type: "redirect", url: undefined } }));
    expect(adapted.action.type).toBe("continue");
  });
});

// ── unknown / fallthrough → continue ─────────────────────────────────────────

describe("adaptLegacyRule() — unknown action fallback", () => {
  it("falls back to continue for an unrecognized action type", () => {
    const rule    = makeRule({ action: { type: "unknown_action" as never } });
    const adapted = adaptLegacyRule(rule);
    expect(adapted.action.type).toBe("continue");
  });
});

// ── condition fields ──────────────────────────────────────────────────────────

describe("adaptLegacyRule() — condition field mapping", () => {
  it("maps step from condition to stepId in both the root and the leaf", () => {
    const adapted = adaptLegacyRule(makeRule({ condition: { step: "step-42", operator: "equals", value: "x" } }));
    expect(adapted.stepId).toBe("step-42");
    const leaf    = adapted.conditions.items[0] as unknown as Record<string, unknown>;
    expect(leaf.stepId).toBe("step-42");
  });

  it("handles numeric value in legacy condition", () => {
    const adapted = adaptLegacyRule(makeRule({ condition: { step: "s1", operator: "greater_than", value: 18 } }));
    const leaf    = adapted.conditions.items[0] as unknown as Record<string, unknown>;
    expect(leaf.value).toBe(18);
  });

  it("handles array value in legacy condition", () => {
    const adapted = adaptLegacyRule(makeRule({ condition: { step: "s1", operator: "in", value: ["a", "b", "c"] } }));
    const leaf    = adapted.conditions.items[0] as unknown as Record<string, unknown>;
    expect(leaf.value).toEqual(["a", "b", "c"]);
  });

  it("handles missing value (undefined) in legacy condition", () => {
    const adapted = adaptLegacyRule(makeRule({ condition: { step: "s1", operator: "empty", value: undefined } }));
    const leaf    = adapted.conditions.items[0] as unknown as Record<string, unknown>;
    expect(leaf.value).toBeUndefined();
  });
});
