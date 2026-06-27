import type {
  EngineDefinition,
  EngineRule,
  ConditionNode,
  ValidationError,
} from "./types";
import { isRegexSafe } from "./operators";
import { validationError } from "./errors";

// ── Rule schema validation ────────────────────────────────────────────────────

export function validateRules(def: EngineDefinition): ValidationError[] {
  const errors: ValidationError[] = [];
  const stepIds   = new Set(def.steps.map(s => s.id));
  const endingIds = new Set(def.endings?.map(e => e.id) ?? []);

  for (const rule of def.rules) {
    // Validate action targets
    switch (rule.action.type) {
      case "jump":
        if (!rule.action.stepId || !stepIds.has(rule.action.stepId)) {
          errors.push(validationError(
            rule.id,
            "STEP_NOT_FOUND",
            `Rule "${rule.id}": jump target step "${rule.action.stepId}" not found.`,
          ));
        }
        break;

      case "ending":
        if (endingIds.size > 0 && !endingIds.has(rule.action.endingId)) {
          errors.push(validationError(
            rule.id,
            "ENDING_NOT_FOUND",
            `Rule "${rule.id}": ending "${rule.action.endingId}" not found.`,
          ));
        }
        break;

      case "redirect":
        if (!rule.action.url) {
          errors.push(validationError(
            rule.id,
            "ACTION_TARGET_MISSING",
            `Rule "${rule.id}": redirect action requires a url.`,
          ));
        }
        break;

      default:
        break;
    }

    // Validate condition tree
    validateConditionNode(rule.id, rule.conditions, errors, 0);
  }

  return errors;
}

function validateConditionNode(
  ruleId: string,
  node: ConditionNode,
  errors: ValidationError[],
  depth: number,
): void {
  if (depth > 10) {
    errors.push(validationError(
      ruleId,
      "CONDITION_DEPTH_EXCEEDED",
      `Rule "${ruleId}": condition tree exceeds maximum depth of 10.`,
    ));
    return;
  }

  if ("items" in node) {
    for (const item of node.items) {
      validateConditionNode(ruleId, item, errors, depth + 1);
    }
    return;
  }

  // LeafCondition — validate regex safety
  if (node.operator === "regex") {
    const val = node.value;
    if (typeof val === "string" && !isRegexSafe(val)) {
      errors.push(validationError(
        ruleId,
        "OPERATOR_REGEX_UNSAFE",
        `Rule "${ruleId}": regex pattern may cause catastrophic backtracking: ${val}`,
      ));
    }
  }
}

// ── Cycle detection ───────────────────────────────────────────────────────────

/**
 * Detects cycles in the jump graph using DFS with 3-color marking.
 * Cost: O(V + E) where V = steps, E = jump rules.
 * Run once at engine construction time.
 */
export function detectCycles(def: EngineDefinition): ValidationError[] {
  const errors: ValidationError[] = [];

  // Build adjacency list: stepId → { targetStepId, ruleId }[]
  const adjacency = new Map<string, Array<{ target: string; ruleId: string }>>();
  for (const step of def.steps) {
    adjacency.set(step.id, []);
  }
  for (const rule of def.rules) {
    if (rule.action.type === "jump") {
      const edges = adjacency.get(rule.stepId);
      if (edges) edges.push({ target: rule.action.stepId, ruleId: rule.id });
    }
  }

  // DFS with 3-color marking: 0=WHITE, 1=GRAY (in-progress), 2=BLACK (done)
  const color = new Map<string, 0 | 1 | 2>();
  for (const step of def.steps) color.set(step.id, 0);

  const reported = new Set<string>(); // avoid duplicate cycle errors

  function dfs(stepId: string): void {
    color.set(stepId, 1); // GRAY
    for (const { target, ruleId } of adjacency.get(stepId) ?? []) {
      const c = color.get(target);
      const cycleKey = `${stepId}→${target}`;
      if (c === 1 && !reported.has(cycleKey)) {
        reported.add(cycleKey);
        errors.push(validationError(
          ruleId,
          "CYCLE_DETECTED",
          `Cycle detected in jump graph: ${stepId} → ${target}. This will cause infinite navigation.`,
        ));
      } else if (c === 0) {
        dfs(target);
      }
    }
    color.set(stepId, 2); // BLACK
  }

  for (const step of def.steps) {
    if (color.get(step.id) === 0) dfs(step.id);
  }

  return errors;
}

// ── Rule deduplication utility ────────────────────────────────────────────────

/**
 * Identifies rules with duplicate IDs.
 * Duplicate IDs cause unpredictable evaluation order.
 */
export function findDuplicateRuleIds(rules: ReadonlyArray<EngineRule>): ValidationError[] {
  const seen = new Set<string>();
  const errors: ValidationError[] = [];

  for (const rule of rules) {
    if (seen.has(rule.id)) {
      errors.push(validationError(
        rule.id,
        "RULE_INVALID",
        `Rule ID "${rule.id}" is duplicated. Rule IDs must be unique.`,
      ));
    }
    seen.add(rule.id);
  }

  return errors;
}
