import type { ConditionOperator, ConditionValue, OperatorFn } from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  return String(v ?? "").toLowerCase();
}

function num(v: unknown): number {
  return typeof v === "number" ? v : parseFloat(String(v ?? ""));
}

function isEmpty(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string")         return v.trim() === "";
  if (Array.isArray(v))              return v.length === 0;
  return false;
}

function toArray(v: ConditionValue | undefined): string[] {
  if (Array.isArray(v)) return v.map(s => String(s).toLowerCase().trim());
  if (typeof v === "string") return v.split(",").map(s => s.toLowerCase().trim());
  return [];
}

// ── ReDoS heuristic ───────────────────────────────────────────────────────────
// Detects the most common catastrophic backtracking patterns:
// (a+)+  (a|aa)+  ([a-z]+)+  (a+)*  etc.
const REDOS_HEURISTIC = /\([^)]*[+*][^)]*\)[+*]|\([^)]*\|[^)]*\)[+*]/;

export function isRegexSafe(pattern: string): boolean {
  return !REDOS_HEURISTIC.test(pattern);
}

// ── Operator registry ─────────────────────────────────────────────────────────

export const OPERATOR_REGISTRY: Record<ConditionOperator, OperatorFn> = {
  // ── Equality ────────────────────────────────────────────────────────────────
  equals:     (a, v) => str(a) === str(v),
  not_equals: (a, v) => str(a) !== str(v),

  // ── Text ────────────────────────────────────────────────────────────────────
  contains:     (a, v) => str(a).includes(str(v)),
  not_contains: (a, v) => !str(a).includes(str(v)),
  starts_with:  (a, v) => str(a).startsWith(str(v)),
  ends_with:    (a, v) => str(a).endsWith(str(v)),

  // ── Regex — caller must validate pattern safety before reaching this fn ─────
  regex: (a, v) => {
    if (typeof v !== "string") return false;
    try {
      return new RegExp(v, "i").test(String(a ?? ""));
    } catch {
      return false;
    }
  },

  // ── Presence ─────────────────────────────────────────────────────────────────
  empty:     (a) => isEmpty(a),
  not_empty: (a) => !isEmpty(a),

  // ── Numeric ──────────────────────────────────────────────────────────────────
  greater_than:     (a, v) => { const n = num(a); return !isNaN(n) && n > num(v);  },
  less_than:        (a, v) => { const n = num(a); return !isNaN(n) && n < num(v);  },
  greater_or_equal: (a, v) => { const n = num(a); return !isNaN(n) && n >= num(v); },
  less_or_equal:    (a, v) => { const n = num(a); return !isNaN(n) && n <= num(v); },

  between: (a, v) => {
    const n = num(a);
    if (isNaN(n)) return false;
    if (Array.isArray(v) && v.length === 2) {
      return n >= Number(v[0]) && n <= Number(v[1]);
    }
    if (typeof v === "string") {
      const parts = v.split(",").map(Number);
      return parts.length === 2 && n >= parts[0] && n <= parts[1];
    }
    return false;
  },

  // ── Set ──────────────────────────────────────────────────────────────────────
  in:     (a, v) => toArray(v).includes(str(a)),
  not_in: (a, v) => !toArray(v).includes(str(a)),
};
