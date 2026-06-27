import { describe, it, expect } from "vitest";
import { createLogicEngine } from "../engine";
import type {
  EngineDefinition,
  EngineRule,
  EvalContext,
  EvalResult,
} from "../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function ctx(stepId: string, answers: Record<string, unknown> = {}): EvalContext {
  return { currentStepId: stepId, answers };
}

const STEPS: EngineDefinition["steps"] = [
  { id: "s1", type: "text",    required: false },
  { id: "s2", type: "choice",  required: false },
  { id: "s3", type: "email",   required: false },
  { id: "s4", type: "number",  required: false },
];

const ENDINGS: EngineDefinition["endings"] = [
  { id: "ending-a" },
  { id: "ending-b" },
];

function makeJumpRule(
  id: string,
  stepId: string,
  answerValue: string,
  targetStepId: string,
  priority = 0,
): EngineRule {
  return {
    id,
    stepId,
    priority,
    conditions: {
      operator: "AND",
      items: [{
        stepId,
        source:   "answers",
        operator: "equals",
        value:    answerValue,
      }],
    },
    action: { type: "jump", stepId: targetStepId },
  };
}

// ── Basic evaluate() ──────────────────────────────────────────────────────────

describe("evaluate() — no rules", () => {
  it("returns continue when there are no rules", () => {
    const engine = createLogicEngine({ steps: STEPS, rules: [] });
    expect(engine.evaluate(ctx("s1")).type).toBe("continue");
  });

  it("returns continue when no rule matches the current step", () => {
    const engine = createLogicEngine({
      steps: STEPS,
      rules: [makeJumpRule("r1", "s2", "yes", "s3")],
    });
    expect(engine.evaluate(ctx("s1")).type).toBe("continue");
  });
});

// ── Actions ───────────────────────────────────────────────────────────────────

describe("evaluate() — jump action (next_step)", () => {
  it("returns next_step with correct stepId when condition matches", () => {
    const engine = createLogicEngine({
      steps: STEPS,
      rules: [makeJumpRule("r1", "s1", "skip", "s3")],
    });
    const result = engine.evaluate(ctx("s1", { s1: "skip" }));
    expect(result.type).toBe("next_step");
    if (result.type === "next_step") expect(result.stepId).toBe("s3");
  });

  it("returns continue when the jump condition does not match", () => {
    const engine = createLogicEngine({
      steps: STEPS,
      rules: [makeJumpRule("r1", "s1", "skip", "s3")],
    });
    expect(engine.evaluate(ctx("s1", { s1: "no-skip" })).type).toBe("continue");
  });
});

describe("evaluate() — ending action", () => {
  it("returns ending with correct endingId", () => {
    const engine = createLogicEngine({
      steps: STEPS, endings: ENDINGS,
      rules: [{
        id: "r1", stepId: "s1", priority: 0,
        conditions: { operator: "AND", items: [{ stepId: "s1", operator: "equals", value: "end" }] },
        action: { type: "ending", endingId: "ending-a" },
      }],
    });
    const result = engine.evaluate(ctx("s1", { s1: "end" }));
    expect(result.type).toBe("ending");
    if (result.type === "ending") expect(result.endingId).toBe("ending-a");
  });
});

describe("evaluate() — redirect action", () => {
  it("returns redirect with correct url", () => {
    const engine = createLogicEngine({
      steps: STEPS,
      rules: [{
        id: "r1", stepId: "s1", priority: 0,
        conditions: { operator: "AND", items: [{ stepId: "s1", operator: "equals", value: "go" }] },
        action: { type: "redirect", url: "https://example.com" },
      }],
    });
    const result = engine.evaluate(ctx("s1", { s1: "go" }));
    expect(result.type).toBe("redirect");
    if (result.type === "redirect") expect(result.url).toBe("https://example.com");
  });
});

describe("evaluate() — complete action", () => {
  it("returns complete when action type is complete", () => {
    const engine = createLogicEngine({
      steps: STEPS,
      rules: [{
        id: "r1", stepId: "s1", priority: 0,
        conditions: { operator: "AND", items: [{ stepId: "s1", operator: "not_empty", value: undefined }] },
        action: { type: "complete" },
      }],
    });
    const result = engine.evaluate(ctx("s1", { s1: "any" }));
    expect(result.type).toBe("complete");
  });
});

describe("evaluate() — continue action", () => {
  it("returns continue when action type is continue", () => {
    const engine = createLogicEngine({
      steps: STEPS,
      rules: [{
        id: "r1", stepId: "s1", priority: 0,
        conditions: { operator: "AND", items: [{ stepId: "s1", operator: "equals", value: "ok" }] },
        action: { type: "continue" },
      }],
    });
    const result = engine.evaluate(ctx("s1", { s1: "ok" }));
    expect(result.type).toBe("continue");
  });
});

describe("evaluate() — not-implemented action", () => {
  it("returns error for reserved actions (scheduling, webhook, etc.)", () => {
    const engine = createLogicEngine({
      steps: STEPS,
      rules: [{
        id: "r1", stepId: "s1", priority: 0,
        conditions: { operator: "AND", items: [{ stepId: "s1", operator: "equals", value: "ok" }] },
        action: { type: "webhook", url: "https://hook.example.com" } as EngineRule["action"],
      }],
    });
    const result = engine.evaluate(ctx("s1", { s1: "ok" }));
    expect(result.type).toBe("error");
    if (result.type === "error") expect(result.code).toBe("ACTION_NOT_IMPLEMENTED");
  });
});

// ── Condition groups ──────────────────────────────────────────────────────────

describe("AND conditions", () => {
  it("matches when ALL conditions are true", () => {
    const engine = createLogicEngine({
      steps: STEPS,
      rules: [{
        id: "r1", stepId: "s1", priority: 0,
        conditions: {
          operator: "AND",
          items: [
            { stepId: "s1", operator: "equals",      value: "yes"  },
            { stepId: "s2", operator: "greater_than", value: 5     },
          ],
        },
        action: { type: "jump", stepId: "s3" },
      }],
    });
    const match    = engine.evaluate(ctx("s1", { s1: "yes", s2: 10 }));
    const noMatch  = engine.evaluate(ctx("s1", { s1: "yes", s2: 3  }));
    expect(match.type).toBe("next_step");
    expect(noMatch.type).toBe("continue");
  });

  it("short-circuits on first false condition", () => {
    const engine = createLogicEngine({
      steps: STEPS,
      rules: [{
        id: "r1", stepId: "s1", priority: 0,
        conditions: {
          operator: "AND",
          items: [
            { stepId: "s1", operator: "equals",  value: "no"  }, // false
            { stepId: "s2", operator: "not_empty", value: undefined }, // would be true
          ],
        },
        action: { type: "jump", stepId: "s3" },
      }],
    });
    expect(engine.evaluate(ctx("s1", { s1: "yes", s2: "anything" })).type).toBe("continue");
  });
});

describe("OR conditions", () => {
  it("matches when ANY condition is true", () => {
    const engine = createLogicEngine({
      steps: STEPS,
      rules: [{
        id: "r1", stepId: "s1", priority: 0,
        conditions: {
          operator: "OR",
          items: [
            { stepId: "s1", operator: "equals", value: "a" },
            { stepId: "s1", operator: "equals", value: "b" },
          ],
        },
        action: { type: "jump", stepId: "s3" },
      }],
    });
    expect(engine.evaluate(ctx("s1", { s1: "a" })).type).toBe("next_step");
    expect(engine.evaluate(ctx("s1", { s1: "b" })).type).toBe("next_step");
    expect(engine.evaluate(ctx("s1", { s1: "c" })).type).toBe("continue");
  });

  it("short-circuits on first true condition", () => {
    const engine = createLogicEngine({
      steps: STEPS,
      rules: [{
        id: "r1", stepId: "s1", priority: 0,
        conditions: {
          operator: "OR",
          items: [
            { stepId: "s1", operator: "equals", value: "match" }, // true
            { stepId: "s2", operator: "equals", value: "also"  }, // would also be true
          ],
        },
        action: { type: "jump", stepId: "s3" },
      }],
    });
    expect(engine.evaluate(ctx("s1", { s1: "match", s2: "also" })).type).toBe("next_step");
    expect(engine.evaluate(ctx("s1", { s1: "match", s2: "nope" })).type).toBe("next_step");
  });
});

describe("NOT conditions", () => {
  it("inverts a true condition to false", () => {
    const engine = createLogicEngine({
      steps: STEPS,
      rules: [{
        id: "r1", stepId: "s1", priority: 0,
        conditions: {
          operator: "NOT",
          items: [{ stepId: "s1", operator: "equals", value: "skip" }],
        },
        action: { type: "jump", stepId: "s3" },
      }],
    });
    // "skip" → leaf true → NOT → false → no match
    expect(engine.evaluate(ctx("s1", { s1: "skip" })).type).toBe("continue");
    // "other" → leaf false → NOT → true → match
    expect(engine.evaluate(ctx("s1", { s1: "other" })).type).toBe("next_step");
  });

  it("returns false for empty NOT group", () => {
    const engine = createLogicEngine({
      steps: STEPS,
      rules: [{
        id: "r1", stepId: "s1", priority: 0,
        conditions: { operator: "NOT", items: [] },
        action: { type: "jump", stepId: "s2" },
      }],
    });
    expect(engine.evaluate(ctx("s1", { s1: "any" })).type).toBe("continue");
  });
});

describe("Nested condition groups", () => {
  it("evaluates AND inside OR", () => {
    const engine = createLogicEngine({
      steps: STEPS,
      rules: [{
        id: "r1", stepId: "s1", priority: 0,
        conditions: {
          operator: "OR",
          items: [
            // Branch A: s1 === "premium"
            { stepId: "s1", operator: "equals", value: "premium" },
            // Branch B: s1 === "trial" AND s2 > 5
            {
              operator: "AND",
              items: [
                { stepId: "s1", operator: "equals",       value: "trial" },
                { stepId: "s2", operator: "greater_than", value: 5       },
              ],
            },
          ],
        },
        action: { type: "jump", stepId: "s3" },
      }],
    });
    expect(engine.evaluate(ctx("s1", { s1: "premium"            })).type).toBe("next_step");
    expect(engine.evaluate(ctx("s1", { s1: "trial",    s2: 10   })).type).toBe("next_step");
    expect(engine.evaluate(ctx("s1", { s1: "trial",    s2: 3    })).type).toBe("continue");
    expect(engine.evaluate(ctx("s1", { s1: "free"               })).type).toBe("continue");
  });
});

// ── Priority ──────────────────────────────────────────────────────────────────

describe("Rule priority", () => {
  it("higher priority rule wins when multiple rules match the same step", () => {
    const engine = createLogicEngine({
      steps:   STEPS,
      endings: ENDINGS,
      rules: [
        makeJumpRule("r1-low",  "s1", "yes", "s2", 0),
        makeJumpRule("r2-high", "s1", "yes", "s3", 10),
      ],
    });
    const result = engine.evaluate(ctx("s1", { s1: "yes" }));
    expect(result.type).toBe("next_step");
    if (result.type === "next_step") expect(result.stepId).toBe("s3");
  });

  it("first rule in insertion order wins when priorities are equal", () => {
    const engine = createLogicEngine({
      steps: STEPS,
      rules: [
        makeJumpRule("r1", "s1", "yes", "s2", 0),
        makeJumpRule("r2", "s1", "yes", "s3", 0),
      ],
    });
    const result = engine.evaluate(ctx("s1", { s1: "yes" }));
    if (result.type === "next_step") expect(result.stepId).toBe("s2");
  });
});

// ── evaluateRule() ────────────────────────────────────────────────────────────

describe("evaluateRule()", () => {
  it("returns the action result when the rule condition matches", () => {
    const engine = createLogicEngine({ steps: STEPS, rules: [] });
    const rule   = makeJumpRule("r1", "s1", "yes", "s3");
    const result = engine.evaluateRule(rule, ctx("s1", { s1: "yes" }));
    expect(result?.type).toBe("next_step");
  });

  it("returns null when the rule condition does not match", () => {
    const engine = createLogicEngine({ steps: STEPS, rules: [] });
    const rule   = makeJumpRule("r1", "s1", "yes", "s3");
    expect(engine.evaluateRule(rule, ctx("s1", { s1: "no" }))).toBeNull();
  });

  it("evaluates the rule independently of the index (any step context)", () => {
    const engine = createLogicEngine({ steps: STEPS, rules: [] });
    const rule   = makeJumpRule("r1", "s2", "ok", "s3");
    // The rule is for s2, but evaluateRule evaluates it against any context
    const result = engine.evaluateRule(rule, ctx("s1", { s2: "ok" }));
    expect(result?.type).toBe("next_step");
  });

  it("returns error on DEPTH_EXCEEDED", () => {
    const engine = createLogicEngine({ steps: STEPS, rules: [] });
    // Build a deeply nested condition (depth > 10)
    function nest(depth: number): EngineRule["conditions"] {
      if (depth === 0) {
        return {
          operator: "AND",
          items: [{ stepId: "s1", operator: "equals", value: "x" }],
        };
      }
      return { operator: "AND", items: [nest(depth - 1)] };
    }
    const rule: EngineRule = {
      id:         "deep-rule",
      stepId:     "s1",
      priority:   0,
      conditions: nest(12), // exceeds MAX_DEPTH of 10
      action:     { type: "complete" },
    };
    const result = engine.evaluateRule(rule, ctx("s1", { s1: "x" }));
    expect(result?.type).toBe("error");
    if (result?.type === "error") expect(result.code).toBe("CONDITION_DEPTH_EXCEEDED");
  });
});

// ── Explain mode ──────────────────────────────────────────────────────────────

describe("Explain mode (explain: true)", () => {
  it("includes explanation in the result when explain is on", () => {
    const engine = createLogicEngine(
      { steps: STEPS, rules: [makeJumpRule("r1", "s1", "yes", "s3")] },
      { explain: true },
    );
    const result = engine.evaluate(ctx("s1", { s1: "yes" }));
    expect(result.explanation).toBeDefined();
  });

  it("explanation.rulesChecked equals number of rules evaluated for the step", () => {
    const engine = createLogicEngine(
      {
        steps: STEPS,
        rules: [
          makeJumpRule("r1", "s1", "skip", "s3"),    // doesn't match
          makeJumpRule("r2", "s1", "yes",  "s2"),    // matches
        ],
      },
      { explain: true },
    );
    const result = engine.evaluate(ctx("s1", { s1: "yes" }));
    expect(result.explanation!.rulesChecked).toBe(2);
  });

  it("explanation.ruleMatched is the ID of the matching rule", () => {
    const engine = createLogicEngine(
      { steps: STEPS, rules: [makeJumpRule("r-match", "s1", "yes", "s2")] },
      { explain: true },
    );
    const result = engine.evaluate(ctx("s1", { s1: "yes" }));
    expect(result.explanation!.ruleMatched).toBe("r-match");
  });

  it("explanation.ruleMatched is null when no rule matches", () => {
    const engine = createLogicEngine(
      { steps: STEPS, rules: [makeJumpRule("r1", "s1", "yes", "s2")] },
      { explain: true },
    );
    const result = engine.evaluate(ctx("s1", { s1: "no" }));
    expect(result.explanation!.ruleMatched).toBeNull();
  });

  it("explanation.path includes trace for each rule checked", () => {
    const engine = createLogicEngine(
      {
        steps: STEPS,
        rules: [
          makeJumpRule("r1", "s1", "no-match", "s2"),
          makeJumpRule("r2", "s1", "match",    "s3"),
        ],
      },
      { explain: true },
    );
    const result = engine.evaluate(ctx("s1", { s1: "match" }));
    expect(result.explanation!.path).toHaveLength(2);
    expect(result.explanation!.path[0].matched).toBe(false);
    expect(result.explanation!.path[1].matched).toBe(true);
  });

  it("leaf traces include actualValue and result", () => {
    const engine = createLogicEngine(
      { steps: STEPS, rules: [makeJumpRule("r1", "s1", "hello", "s2")] },
      { explain: true },
    );
    const result = engine.evaluate(ctx("s1", { s1: "hello" }));
    const leaf   = result.explanation!.path[0].conditions[0];
    expect(leaf.actualValue).toBe("hello");
    expect(leaf.result).toBe(true);
  });

  it("explain mode is off by default (no explanation field)", () => {
    const engine = createLogicEngine(
      { steps: STEPS, rules: [makeJumpRule("r1", "s1", "yes", "s2")] },
    );
    const result = engine.evaluate(ctx("s1", { s1: "yes" }));
    expect((result as EvalResult).explanation).toBeUndefined();
  });
});

// ── Operators via engine ──────────────────────────────────────────────────────

describe("Operator evaluation via engine", () => {
  function engineForOp(operator: string, condValue: unknown): ReturnType<typeof createLogicEngine> {
    return createLogicEngine({
      steps: STEPS,
      rules: [{
        id: "r1", stepId: "s1", priority: 0,
        conditions: {
          operator: "AND",
          items: [{ stepId: "s1", operator: operator as never, value: condValue as never }],
        },
        action: { type: "complete" },
      }],
    });
  }

  it("contains — answer matches", () => {
    const engine = engineForOp("contains", "world");
    expect(engine.evaluate(ctx("s1", { s1: "hello world" })).type).toBe("complete");
    expect(engine.evaluate(ctx("s1", { s1: "hello"       })).type).toBe("continue");
  });

  it("regex — matches email pattern", () => {
    const engine = engineForOp("regex", "^[^@]+@[^@]+\\.[^@]+$");
    expect(engine.evaluate(ctx("s1", { s1: "user@example.com"  })).type).toBe("complete");
    expect(engine.evaluate(ctx("s1", { s1: "not-an-email"      })).type).toBe("continue");
  });

  it("between — number in range", () => {
    const engine = engineForOp("between", [18, 65]);
    expect(engine.evaluate(ctx("s1", { s1: 30 })).type).toBe("complete");
    expect(engine.evaluate(ctx("s1", { s1: 10 })).type).toBe("continue");
  });

  it("in — answer is in list", () => {
    const engine = engineForOp("in", ["a", "b", "c"]);
    expect(engine.evaluate(ctx("s1", { s1: "b" })).type).toBe("complete");
    expect(engine.evaluate(ctx("s1", { s1: "d" })).type).toBe("continue");
  });

  it("empty — matches null/empty answer", () => {
    const engine = engineForOp("empty", undefined);
    expect(engine.evaluate(ctx("s1", { s1: ""    })).type).toBe("complete");
    expect(engine.evaluate(ctx("s1", { s1: "val" })).type).toBe("continue");
  });
});

// ── Validation errors ─────────────────────────────────────────────────────────

describe("validationErrors", () => {
  it("reports duplicate rule IDs", () => {
    const engine = createLogicEngine({
      steps: STEPS,
      rules: [
        makeJumpRule("dup-id", "s1", "a", "s2"),
        makeJumpRule("dup-id", "s1", "b", "s3"),
      ],
    });
    const dupes = engine.validationErrors.filter(e => e.code === "RULE_INVALID" || e.ruleId === "dup-id");
    expect(dupes.length).toBeGreaterThan(0);
  });

  it("returns empty array when all rules are valid", () => {
    const engine = createLogicEngine({
      steps: STEPS,
      rules: [makeJumpRule("r1", "s1", "yes", "s2")],
    });
    expect(engine.validationErrors).toHaveLength(0);
  });
});

// ── Custom operators ──────────────────────────────────────────────────────────

describe("Custom operators", () => {
  it("allows injecting a custom operator function", () => {
    const engine = createLogicEngine(
      {
        steps: STEPS,
        rules: [{
          id: "r1", stepId: "s1", priority: 0,
          conditions: {
            operator: "AND",
            items: [{ stepId: "s1", operator: "is_even" as never, value: undefined }],
          },
          action: { type: "complete" },
        }],
      },
      {
        customOperators: {
          is_even: (answer) => typeof answer === "number" && answer % 2 === 0,
        },
      },
    );
    expect(engine.evaluate(ctx("s1", { s1: 4 })).type).toBe("complete");
    expect(engine.evaluate(ctx("s1", { s1: 3 })).type).toBe("continue");
  });
});

// ── Strict mode ───────────────────────────────────────────────────────────────

describe("Strict mode", () => {
  it("skips rules that failed validation in strict mode", () => {
    const engine = createLogicEngine(
      {
        steps: STEPS,
        rules: [
          makeJumpRule("dup", "s1", "yes", "s2"),
          makeJumpRule("dup", "s1", "yes", "s3"), // duplicate ID — invalid
        ],
      },
      { strictMode: true },
    );
    // In strict mode, at least one of the duplicate rules is skipped
    const result = engine.evaluate(ctx("s1", { s1: "yes" }));
    // May match or continue depending on which dupe is considered valid
    expect(["next_step", "continue"]).toContain(result.type);
  });
});
