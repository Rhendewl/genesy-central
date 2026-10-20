import { metricProgress } from "./objective-progress";

export const BSC_PERSPECTIVES = {
  financeira: "Financeira",
  clientes: "Clientes",
  processos: "Processos internos",
  aprendizado: "Aprendizado e crescimento",
} as const;
export type BscPerspective = keyof typeof BSC_PERSPECTIVES;
export interface BscMetric {
  id: string;
  objective_id: string;
  title: string;
  description?: string;
  unit: string;
  baseline: number;
  target: number;
  current_value: number;
}
export function mean(values: number[]): number | null {
  return values.length
    ? values.reduce((sum, n) => sum + n, 0) / values.length
    : null;
}
// Each objective has equal weight, regardless of the number of indicators.
// No indicator is different from zero achievement. Cancelled objectives are excluded.
export function bscSummary(
  objectives: {
    id: string;
    perspective?: BscPerspective | null;
    status: string;
  }[],
  metrics: BscMetric[],
) {
  const scores = new Map(
    objectives.map((o) => [
      o.id,
      mean(
        metrics
          .filter((m) => m.objective_id === o.id)
          .map((m) =>
            metricProgress(
              Number(m.baseline),
              Number(m.target),
              Number(m.current_value),
            ),
          ),
      ),
    ]),
  );
  const perspectives = Object.entries(BSC_PERSPECTIVES).map(([id, label]) => {
    const included = objectives.filter(
      (o) => o.perspective === id && o.status !== "cancelado",
    );
    const values = included
      .map((o) => scores.get(o.id) ?? null)
      .filter((n): n is number => n !== null);
    return {
      id: id as BscPerspective,
      label,
      score: mean(values),
      total: included.length,
      measured: values.length,
    };
  });
  return {
    scores,
    perspectives,
    overall: mean(
      perspectives.map((p) => p.score).filter((n): n is number => n !== null),
    ),
  };
}

// The month filters the objective's date range. It never resets its metrics.
export function objectiveInMonth(
  objective: { start_date?: string | null; due_date?: string | null },
  month: string,
) {
  return (
    !month ||
    ((!objective.start_date || objective.start_date.slice(0, 7) <= month) &&
      (!objective.due_date || objective.due_date.slice(0, 7) >= month))
  );
}
export function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
