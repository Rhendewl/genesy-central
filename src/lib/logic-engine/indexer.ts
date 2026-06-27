import type { EngineRule } from "./types";

export type RuleIndex = ReadonlyMap<string, ReadonlyArray<EngineRule>>;

/**
 * Builds a rule index keyed by stepId.
 *
 * Cost: O(n log n) — one-time at engine construction.
 * Lookup: O(1) — hash map get.
 *
 * Ordering within each bucket:
 *   1. priority DESC  (higher priority fires first)
 *   2. insertion order ASC  (stable tie-breaking: first rule defined wins)
 */
export function buildRuleIndex(rules: ReadonlyArray<EngineRule>): RuleIndex {
  // Map insertion index for stable sort (O(1) lookup during compare)
  const insertionIndex = new Map<EngineRule, number>();
  rules.forEach((rule, i) => insertionIndex.set(rule, i));

  const map = new Map<string, EngineRule[]>();

  for (const rule of rules) {
    let bucket = map.get(rule.stepId);
    if (!bucket) {
      bucket = [];
      map.set(rule.stepId, bucket);
    }
    bucket.push(rule);
  }

  // Sort each bucket once during construction
  map.forEach((bucket, key) => {
    const sorted = [...bucket].sort((a, b) => {
      const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);
      if (priorityDiff !== 0) return priorityDiff;
      // Tie-break: earlier rule wins
      return (insertionIndex.get(a) ?? 0) - (insertionIndex.get(b) ?? 0);
    });
    map.set(key, sorted);
  });

  return map as RuleIndex;
}
