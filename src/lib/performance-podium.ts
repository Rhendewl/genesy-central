import type { PerformanceCollaborator } from "@/types/performance";

export const LOW_PERFORMANCE_SCORE = 60;

export function selectPerformancePodium(
  ranking: PerformanceCollaborator[],
): PerformanceCollaborator[] {
  return [...ranking]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

export function selectLowPerformers(
  ranking: PerformanceCollaborator[],
  limit = 4,
): PerformanceCollaborator[] {
  return ranking
    .filter((person) => person.score < LOW_PERFORMANCE_SCORE)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);
}
