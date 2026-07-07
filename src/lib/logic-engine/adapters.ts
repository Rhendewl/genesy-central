import type { LogicRule } from "@/types";
import type { EngineRule, RuleAction, ConditionOperator } from "./types";

/**
 * Converts the current flat LogicRule format (single condition + action)
 * to the engine's EngineRule format (ConditionGroup tree).
 *
 * Backward compatible: no database migration required.
 * Called in useFormularioRenderer before passing rules to createLogicEngine.
 */
export function adaptLegacyRule(legacy: LogicRule): EngineRule {
  return {
    id:       legacy.id,
    stepId:   legacy.condition.step,
    priority: 0,
    conditions: {
      operator: "AND",
      items: [{
        stepId:   legacy.condition.step,
        source:   "answers",
        operator: legacy.condition.operator as ConditionOperator,
        value:    legacy.condition.value as string | number | string[] | undefined,
      }],
    },
    action: adaptLegacyAction(legacy.action),
  };
}

function adaptLegacyAction(action: LogicRule["action"]): RuleAction {
  switch (action.type) {
    case "jump":
      if (!action.target) return { type: "continue" };
      return { type: "jump", stepId: action.target };

    case "end":
      // "end" in legacy = show first ending screen
      return { type: "ending", endingId: action.target ?? "default" };

    case "disqualify":
      // "disqualify" = show an ending (typically a rejection screen)
      return { type: "ending", endingId: action.target ?? "default" };

    case "redirect":
      if (!action.url) return { type: "continue" };
      return { type: "redirect", url: action.url };

    case "complete":
      return { type: "complete" };

    default:
      return { type: "continue" };
  }
}
