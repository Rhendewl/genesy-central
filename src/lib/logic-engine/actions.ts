import type { RuleAction, EvalResult, DecisionTrace } from "./types";
import { engineError } from "./errors";

function buildTrace(
  ruleId: string,
  stepId: string,
  operatorsEvaluated: ReadonlyArray<string>,
  action: RuleAction,
): DecisionTrace {
  return {
    ruleId,
    stepId,
    operatorsEvaluated,
    reason: `Rule "${ruleId}" matched — action: ${action.type}`,
    resolvedTarget: getTarget(action),
  };
}

function getTarget(action: RuleAction): string | undefined {
  switch (action.type) {
    case "jump":    return action.stepId;
    case "ending":  return action.endingId;
    case "redirect": return action.url;
    default:        return undefined;
  }
}

/**
 * Converts a matched RuleAction into an EvalResult.
 * Pure function — no side effects.
 */
export function resolveAction(
  action: RuleAction,
  ruleId: string,
  stepId: string,
  operatorsEvaluated: ReadonlyArray<string>,
): EvalResult {
  const trace = buildTrace(ruleId, stepId, operatorsEvaluated, action);

  switch (action.type) {
    case "jump":
      return { type: "next_step", stepId: action.stepId, trace };

    case "ending":
      return { type: "ending", endingId: action.endingId, trace };

    case "redirect":
      return { type: "redirect", url: action.url, trace };

    case "complete":
      return { type: "complete", trace };

    case "continue":
      return { type: "continue" };

    // ── Reserved actions — graceful not-implemented ───────────────────────────
    case "scheduling":
    case "compute":
    case "set_variable":
    case "increment":
    case "decrement":
    case "webhook":
    case "crm_action":
      return engineError(
        "ACTION_NOT_IMPLEMENTED",
        `Action "${action.type}" is reserved and not implemented in this version.`,
        ruleId,
      );

    default: {
      /* v8 ignore next 4 */
      const exhaustive: never = action;
      return engineError(
        "RULE_INVALID",
        `Unknown action type: ${(exhaustive as { type: string }).type}`,
        ruleId,
      );
    }
  }
}
