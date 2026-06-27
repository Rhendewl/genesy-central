// ─────────────────────────────────────────────────────────────────────────────
// Logic Engine — Public Types
//
// Pure TypeScript. Zero dependencies on React, Supabase, browser APIs, or UI.
// Could be published as a standalone npm package.
// ─────────────────────────────────────────────────────────────────────────────

// ── Context ───────────────────────────────────────────────────────────────────

/** Which part of the context a LeafCondition reads its value from. */
export type ContextSource =
  | "answers"    // step answers  — active in Phase 3.3
  | "variables"  // engine variables (future: set_variable action)
  | "session"    // session metadata (future)
  | "lead"       // CRM lead data   (future)
  | "utm"        // UTM params       (future)
  | "metadata";  // custom metadata  (future)

/**
 * Serializable evaluation context.
 * Only `currentStepId` and `answers` are used in Phase 3.3.
 * All other fields are reserved but accepted without error.
 */
export interface EvalContext {
  readonly currentStepId: string;
  readonly answers: Readonly<Record<string, unknown>>;
  readonly session?:   Readonly<SessionContext>;
  readonly lead?:      Readonly<LeadContext>;
  readonly utm?:       Readonly<UtmContext>;
  readonly metadata?:  Readonly<Record<string, unknown>>;
  readonly variables?: Readonly<Record<string, unknown>>;
}

export interface SessionContext {
  readonly id?:        string;
  readonly startedAt?: number;
  readonly device?:    string;
  readonly browser?:   string;
  readonly os?:        string;
}

export interface LeadContext {
  readonly id?:    string;
  readonly email?: string;
  readonly name?:  string;
  readonly [key: string]: unknown;
}

export interface UtmContext {
  readonly source?:   string;
  readonly medium?:   string;
  readonly campaign?: string;
  readonly term?:     string;
  readonly content?:  string;
}

// ── Condition operators ───────────────────────────────────────────────────────

export type ConditionOperator =
  | "equals"           | "not_equals"
  | "contains"         | "not_contains"
  | "starts_with"      | "ends_with"
  | "regex"
  | "empty"            | "not_empty"
  | "greater_than"     | "less_than"
  | "greater_or_equal" | "less_or_equal"
  | "between"
  | "in"               | "not_in";

export type ConditionValue =
  | string
  | number
  | boolean
  | ReadonlyArray<string>
  | readonly [number, number]; // "between": [min, max]

// ── Condition tree ────────────────────────────────────────────────────────────

/** A node is either a group (AND/OR/NOT of sub-nodes) or a leaf (single comparison). */
export type ConditionNode = ConditionGroup | LeafCondition;

export interface ConditionGroup {
  readonly operator: "AND" | "OR" | "NOT";
  /** AND/OR: 1..n items.  NOT: exactly 1 item. */
  readonly items: ReadonlyArray<ConditionNode>;
}

export interface LeafCondition {
  /**
   * Primary lookup key.
   * When source="answers": the step whose answer is evaluated.
   * When source≠"answers": combined with fieldPath for nested lookup.
   */
  readonly stepId: string;
  /** Context source. Defaults to "answers". */
  readonly source?: ContextSource;
  /**
   * Dot-separated field path for non-"answers" sources.
   * e.g. "utm.source", "lead.email", "session.device"
   */
  readonly fieldPath?: string;
  readonly operator: ConditionOperator;
  readonly value?: ConditionValue;
}

// ── Actions ───────────────────────────────────────────────────────────────────

/**
 * All action types in a sealed discriminated union.
 * Phase 3.3 implements: jump, ending, redirect, complete, continue.
 * All others return ACTION_NOT_IMPLEMENTED gracefully.
 */
export type RuleAction =
  // ── Active ─────────────────────────────────────────────────────────────────
  | { readonly type: "jump";     readonly stepId: string }
  | { readonly type: "ending";   readonly endingId: string }
  | { readonly type: "redirect"; readonly url: string }
  | { readonly type: "complete" }
  | { readonly type: "continue" }
  // ── Reserved (not implemented — ACTION_NOT_IMPLEMENTED) ────────────────────
  | { readonly type: "scheduling";  readonly config?: unknown }
  | { readonly type: "compute";     readonly expression: string }
  | { readonly type: "set_variable"; readonly name: string; readonly value?: unknown }
  | { readonly type: "increment";   readonly variable: string; readonly by?: number }
  | { readonly type: "decrement";   readonly variable: string; readonly by?: number }
  | { readonly type: "webhook";     readonly url: string; readonly payload?: unknown }
  | { readonly type: "crm_action";  readonly action: string; readonly params?: unknown };

// ── Rules ─────────────────────────────────────────────────────────────────────

export interface EngineRule {
  readonly id: string;
  /** The step that triggers evaluation of this rule. */
  readonly stepId: string;
  readonly conditions: ConditionGroup;
  readonly action: RuleAction;
  /**
   * Tie-breaking: higher priority wins within the same step.
   * Rules with equal priority are evaluated in insertion order.
   * Default: 0.
   */
  readonly priority?: number;
}

// ── Engine definition ─────────────────────────────────────────────────────────

export interface StepDefinition {
  readonly id: string;
  readonly type: string;     // opaque to the engine
  readonly required: boolean;
}

export interface EndingDefinition {
  readonly id: string;
}

export interface EngineDefinition {
  readonly steps:    ReadonlyArray<StepDefinition>;
  readonly rules:    ReadonlyArray<EngineRule>;
  readonly endings?: ReadonlyArray<EndingDefinition>;
}

// ── Eval result metadata ──────────────────────────────────────────────────────

/** Included in any result where a rule matched. */
export interface DecisionTrace {
  readonly ruleId:              string;
  readonly stepId:              string;
  readonly operatorsEvaluated:  ReadonlyArray<string>;
  readonly reason:              string;
  readonly resolvedTarget?:     string;
}

/** Per-leaf evaluation trace (explain mode). */
export interface LeafEvalTrace {
  readonly stepId:        string;
  readonly source:        ContextSource;
  readonly operator:      string;
  readonly expectedValue: unknown;
  readonly actualValue:   unknown;
  readonly result:        boolean;
}

/** Per-rule evaluation entry (explain mode). */
export interface ExplainEntry {
  readonly ruleId:     string;
  readonly stepId:     string;
  readonly matched:    boolean;
  readonly conditions: ReadonlyArray<LeafEvalTrace>;
}

/** Full evaluation path returned when explain: true. */
export interface EvalExplanation {
  readonly rulesChecked: number;
  readonly ruleMatched:  string | null;
  readonly path:         ReadonlyArray<ExplainEntry>;
}

// ── Result base ───────────────────────────────────────────────────────────────

/**
 * Common optional metadata present on every result type.
 * `trace` is set when a rule matched.
 * `explanation` is set only when the engine was created with explain: true.
 */
interface EvalResultMeta {
  readonly trace?:       DecisionTrace;
  readonly explanation?: EvalExplanation;
}

// ── Eval results ──────────────────────────────────────────────────────────────

export interface EvalResultNextStep extends EvalResultMeta {
  readonly type: "next_step";
  readonly stepId: string;
}

export interface EvalResultEnding extends EvalResultMeta {
  readonly type: "ending";
  readonly endingId: string;
}

export interface EvalResultRedirect extends EvalResultMeta {
  readonly type: "redirect";
  readonly url: string;
}

export interface EvalResultScheduling extends EvalResultMeta {
  readonly type: "scheduling";
  readonly config?: unknown;
}

export interface EvalResultCompute extends EvalResultMeta {
  readonly type: "compute";
  readonly expression: string;
}

export interface EvalResultSetVariable extends EvalResultMeta {
  readonly type: "set_variable";
  readonly name: string;
  readonly value?: unknown;
}

export interface EvalResultWebhook extends EvalResultMeta {
  readonly type: "webhook";
  readonly url: string;
  readonly payload?: unknown;
}

export interface EvalResultCrmAction extends EvalResultMeta {
  readonly type: "crm_action";
  readonly action: string;
  readonly params?: unknown;
}

export interface EvalResultComplete extends EvalResultMeta {
  readonly type: "complete";
}

/** No rule matched — caller should use sequential navigation. */
export interface EvalResultContinue {
  readonly type: "continue";
  readonly explanation?: EvalExplanation;
}

export interface EvalResultError {
  readonly type:        "error";
  readonly code:        EngineErrorCode;
  readonly message:     string;
  readonly ruleId?:     string;
  readonly explanation?: EvalExplanation;
}

/** Sealed union — all possible outcomes of an evaluation. */
export type EvalResult =
  | EvalResultNextStep
  | EvalResultEnding
  | EvalResultRedirect
  | EvalResultScheduling
  | EvalResultCompute
  | EvalResultSetVariable
  | EvalResultWebhook
  | EvalResultCrmAction
  | EvalResultComplete
  | EvalResultContinue
  | EvalResultError;

export type EvalResultType = EvalResult["type"];

// ── Error codes ───────────────────────────────────────────────────────────────

export type EngineErrorCode =
  | "RULE_INVALID"
  | "STEP_NOT_FOUND"
  | "ENDING_NOT_FOUND"
  | "OPERATOR_UNKNOWN"
  | "OPERATOR_REGEX_UNSAFE"
  | "ACTION_TARGET_MISSING"
  | "ACTION_NOT_IMPLEMENTED"
  | "CYCLE_DETECTED"
  | "CONDITION_DEPTH_EXCEEDED";

export interface ValidationError {
  readonly ruleId:  string;
  readonly code:    EngineErrorCode;
  readonly message: string;
}

// ── Extension ─────────────────────────────────────────────────────────────────

/** Signature for custom operator functions injected via EngineOptions. */
export type OperatorFn = (
  answer: unknown,
  conditionValue: ConditionValue | undefined,
) => boolean;

// ── Engine interface ──────────────────────────────────────────────────────────

export interface LogicEngine {
  /**
   * Evaluate all rules for the current step and return the first match.
   * Returns { type: "continue" } when no rule matches.
   * Pure function: no side effects, no mutation.
   */
  readonly evaluate: (context: EvalContext) => EvalResult;

  /**
   * Evaluate a single rule against the context.
   * Returns null if conditions do not match (rule does not fire).
   * Useful for editor rule preview and unit tests.
   */
  readonly evaluateRule: (rule: EngineRule, context: EvalContext) => EvalResult | null;

  /**
   * Validation errors found during engine construction.
   * The engine still operates with errors, but affected rules may misbehave.
   */
  readonly validationErrors: ReadonlyArray<ValidationError>;
}

// ── Options ───────────────────────────────────────────────────────────────────

export interface EngineOptions {
  /** API version. Reserved for future breaking changes. */
  readonly version?: "1";
  /**
   * In strict mode, rules with validation errors are skipped (return error result).
   * In non-strict (default), the engine evaluates all rules and degrades gracefully.
   */
  readonly strictMode?: boolean;
  /**
   * When true, every EvalResult includes a full evaluation path in `explanation`.
   * Adds minor overhead — do not enable in production hot paths.
   */
  readonly explain?: boolean;
  /** Inject custom operator implementations. Keys must not collide with built-ins. */
  readonly customOperators?: Readonly<Record<string, OperatorFn>>;
  // ── Reserved for Phase 3.4+ ─────────────────────────────────────────────────
  readonly cache?: {
    readonly enabled:  boolean;
    readonly maxSize?: number;
    readonly ttlMs?:   number;
  };
}
