"use client";
import { BscTasks } from "./BscTasks";
export interface ObjectiveMetric {
  id: string;
  objective_id: string;
  title: string;
  unit: string;
  baseline: number;
  target: number;
  current_value: number;
}
export function ObjectivePlanning({
  id,
  onChange,
}: {
  id: string;
  onChange: () => void;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Tarefas</h3>
      <BscTasks objectiveId={id} onChange={onChange} />
    </section>
  );
}
