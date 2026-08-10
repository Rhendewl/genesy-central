const DUPLICATE_WINDOW_DAYS = 30;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

export function canonicalAnswers(answers: Record<string, unknown>): string {
  return JSON.stringify(canonicalize(answers));
}

export function duplicateSubmissionCutoff(now = new Date()): string {
  return new Date(now.getTime() - DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function findExactDuplicateSubmission<T extends { answers: unknown }>(
  candidates: T[],
  answers: Record<string, unknown>,
): T | null {
  const expected = canonicalAnswers(answers);
  return candidates.find(candidate => {
    if (!candidate.answers || typeof candidate.answers !== "object" || Array.isArray(candidate.answers)) return false;
    return canonicalAnswers(candidate.answers as Record<string, unknown>) === expected;
  }) ?? null;
}
