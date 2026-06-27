import type {
  EngineDefinition,
  EngineOptions,
  LogicEngine,
  EvalContext,
  EvalResult,
  EngineRule,
  ExplainEntry,
  EvalExplanation,
  OperatorFn,
} from "./types";
import { buildRuleIndex, type RuleIndex } from "./indexer";
import { validateRules, detectCycles, findDuplicateRuleIds } from "./validator";
import {
  evaluateNode,
  createTraceCollector,
  DEPTH_EXCEEDED,
} from "./evaluator";
import { resolveAction } from "./actions";
import { engineError } from "./errors";

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Creates an immutable Logic Engine instance.
 *
 * Build phase (called once):
 *   - Validates all rules (schema + targets + regex safety)
 *   - Detects cycles in the jump graph
 *   - Builds a priority-sorted index keyed by stepId
 *
 * Evaluation phase (called per step navigation):
 *   - O(1) rule lookup via index
 *   - O(r) condition tree evaluation, r = rules for current step
 *   - Zero allocations when explain mode is off
 */
export function createLogicEngine(
  definition: EngineDefinition,
  options: EngineOptions = {},
): LogicEngine {
  const {
    explain:         explainMode    = false,
    customOperators: customOps      = {},
    strictMode                      = false,
  } = options;

  // ── Build-time analysis ─────────────────────────────────────────────────────

  const validationErrors = [
    ...findDuplicateRuleIds(definition.rules),
    ...validateRules(definition),
    ...detectCycles(definition),
  ];

  // Build invalidRuleIds set for strictMode enforcement
  const invalidRuleIds = strictMode
    ? new Set(validationErrors.map(e => e.ruleId))
    : new Set<string>();

  // ── Index (O(n log n) once) ─────────────────────────────────────────────────

  const ruleIndex: RuleIndex = buildRuleIndex(definition.rules);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const ops = customOps as Record<string, OperatorFn>;

  function buildExplanation(
    path: ExplainEntry[],
    matchedRuleId: string | null,
  ): EvalExplanation {
    return {
      rulesChecked: path.length,
      ruleMatched:  matchedRuleId,
      path:         Object.freeze([...path]),
    };
  }

  // ── evaluate ────────────────────────────────────────────────────────────────

  const evaluate = (context: EvalContext): EvalResult => {
    const { currentStepId } = context;
    const rules = ruleIndex.get(currentStepId) ?? [];

    // Explain path — only allocated when explainMode is on
    const explainPath: ExplainEntry[] = explainMode ? [] : (undefined as unknown as ExplainEntry[]);

    for (const rule of rules) {
      // strictMode: skip rules that failed build-time validation
      if (strictMode && invalidRuleIds.has(rule.id)) continue;

      // Trace collector — null when explain is off (zero overhead)
      const trace = explainMode ? createTraceCollector() : null;

      const condResult = evaluateNode(rule.conditions, context, ops, trace, 0);

      if (condResult === DEPTH_EXCEEDED) {
        const err = engineError(
          "CONDITION_DEPTH_EXCEEDED",
          `Rule "${rule.id}": condition tree exceeded maximum depth.`,
          rule.id,
        );
        if (explainMode) {
          return { ...err, explanation: buildExplanation(explainPath, null) };
        }
        return err;
      }

      if (explainMode && trace) {
        explainPath.push({
          ruleId:     rule.id,
          stepId:     rule.stepId,
          matched:    condResult,
          conditions: Object.freeze([...trace.leafTraces]),
        });
      }

      if (condResult) {
        const operatorsEvaluated = trace
          ? trace.leafTraces.map(t => t.operator)
          : [];

        const result = resolveAction(rule.action, rule.id, rule.stepId, operatorsEvaluated);

        if (explainMode) {
          return { ...result, explanation: buildExplanation(explainPath, rule.id) };
        }
        return result;
      }
    }

    // No rule matched → sequential navigation
    if (explainMode) {
      return { type: "continue", explanation: buildExplanation(explainPath, null) };
    }
    return { type: "continue" };
  };

  // ── evaluateRule ────────────────────────────────────────────────────────────

  const evaluateRule = (rule: EngineRule, context: EvalContext): EvalResult | null => {
    const condResult = evaluateNode(rule.conditions, context, ops, null, 0);

    if (condResult === DEPTH_EXCEEDED) {
      return engineError(
        "CONDITION_DEPTH_EXCEEDED",
        `Rule "${rule.id}": condition tree exceeded maximum depth.`,
        rule.id,
      );
    }

    if (!condResult) return null; // conditions did not match

    return resolveAction(rule.action, rule.id, rule.stepId, []);
  };

  // ── Return immutable instance ───────────────────────────────────────────────

  return Object.freeze({
    evaluate,
    evaluateRule,
    validationErrors: Object.freeze(validationErrors),
  });
}
