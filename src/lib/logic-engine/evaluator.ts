import type {
  ConditionGroup,
  ConditionNode,
  LeafCondition,
  EvalContext,
  LeafEvalTrace,
  OperatorFn,
  ContextSource,
} from "./types";
import { OPERATOR_REGISTRY } from "./operators";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_DEPTH = 10;

// ── Trace collector ───────────────────────────────────────────────────────────

/**
 * Mutable collector passed through the evaluation tree when explain mode is on.
 * When explain mode is off, `null` is passed — no allocation, no function calls,
 * zero overhead on the hot path.
 */
export interface TraceCollector {
  readonly leafTraces: LeafEvalTrace[];
}

export function createTraceCollector(): TraceCollector {
  return { leafTraces: [] };
}

// ── Sentinel ──────────────────────────────────────────────────────────────────

const DEPTH_EXCEEDED = Symbol("depth_exceeded");
type EvalBool = boolean | typeof DEPTH_EXCEEDED;

export { DEPTH_EXCEEDED };

// ── Context resolution ────────────────────────────────────────────────────────

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc !== null && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function resolveAnswer(leaf: LeafCondition, context: EvalContext): unknown {
  const source: ContextSource = leaf.source ?? "answers";

  switch (source) {
    case "answers":
      return context.answers[leaf.stepId];

    case "variables":
      return context.variables?.[leaf.fieldPath ?? leaf.stepId];

    case "session": {
      if (!context.session) return undefined;
      const path = leaf.fieldPath;
      return path ? getNestedValue(context.session, path) : undefined;
    }

    case "lead": {
      if (!context.lead) return undefined;
      const path = leaf.fieldPath;
      return path ? getNestedValue(context.lead, path) : context.lead[leaf.stepId];
    }

    case "utm": {
      if (!context.utm) return undefined;
      const path = leaf.fieldPath;
      return path ? getNestedValue(context.utm, path) : undefined;
    }

    case "metadata":
      return context.metadata?.[leaf.fieldPath ?? leaf.stepId];

    default:
      return undefined;
  }
}

// ── Core evaluation ───────────────────────────────────────────────────────────

export function evaluateNode(
  node: ConditionNode,
  context: EvalContext,
  customOperators: Record<string, OperatorFn>,
  trace: TraceCollector | null,
  depth: number,
): EvalBool {
  if (depth > MAX_DEPTH) return DEPTH_EXCEEDED;

  if ("items" in node) {
    return evaluateGroup(node as ConditionGroup, context, customOperators, trace, depth);
  }
  return evaluateLeaf(node as LeafCondition, context, customOperators, trace);
}

function evaluateGroup(
  group: ConditionGroup,
  context: EvalContext,
  customOperators: Record<string, OperatorFn>,
  trace: TraceCollector | null,
  depth: number,
): EvalBool {
  const { operator, items } = group;
  const nextDepth = depth + 1;

  if (operator === "NOT") {
    const first = items[0];
    if (!first) return false;
    const result = evaluateNode(first, context, customOperators, trace, nextDepth);
    if (result === DEPTH_EXCEEDED) return DEPTH_EXCEEDED;
    return !result;
  }

  if (operator === "AND") {
    for (const item of items) {
      const result = evaluateNode(item, context, customOperators, trace, nextDepth);
      if (result === DEPTH_EXCEEDED) return DEPTH_EXCEEDED;
      if (!result) return false; // short-circuit
    }
    return true;
  }

  // OR
  for (const item of items) {
    const result = evaluateNode(item, context, customOperators, trace, nextDepth);
    if (result === DEPTH_EXCEEDED) return DEPTH_EXCEEDED;
    if (result) return true; // short-circuit
  }
  return false;
}

function evaluateLeaf(
  leaf: LeafCondition,
  context: EvalContext,
  customOperators: Record<string, OperatorFn>,
  trace: TraceCollector | null,
): boolean {
  const answer = resolveAnswer(leaf, context);

  const operatorFn: OperatorFn | undefined =
    (OPERATOR_REGISTRY as Record<string, OperatorFn>)[leaf.operator] ??
    customOperators[leaf.operator];

  // Unknown operator degrades gracefully to false (never throws)
  const result = operatorFn ? operatorFn(answer, leaf.value) : false;

  if (trace) {
    trace.leafTraces.push({
      stepId:        leaf.stepId,
      source:        leaf.source ?? "answers",
      operator:      leaf.operator,
      expectedValue: leaf.value,
      actualValue:   answer,
      result,
    });
  }

  return result;
}
