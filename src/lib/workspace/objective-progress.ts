import type { WorkspaceObjective } from "@/types/workspace-objectives";
export function metricProgress(
  baseline: number,
  target: number,
  current: number,
) {
  if (
    ![baseline, target, current].every(Number.isFinite) ||
    target === baseline
  )
    return 0;
  return Math.max(
    0,
    Math.min(100, ((current - baseline) / (target - baseline)) * 100),
  );
}
export function descendants(
  id: string,
  objectives: Pick<WorkspaceObjective, "id" | "parent_id">[],
) {
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const o of objectives)
      if (o.parent_id && ids.has(o.parent_id) && !ids.has(o.id)) {
        ids.add(o.id);
        changed = true;
      }
  }
  return ids;
}
export function executionProgress(
  id: string,
  objectives: Pick<WorkspaceObjective, "id" | "parent_id">[],
  steps: { id: string; objective_id: string; is_completed: boolean }[],
  links: { objective_id: string; task_id: string }[],
  tasks: { id: string; status: string }[],
) {
  const ids = descendants(id, objectives);
  const scopedSteps = steps.filter((s) => ids.has(s.objective_id));
  const taskIds = new Set(
    links.filter((l) => ids.has(l.objective_id)).map((l) => l.task_id),
  );
  const visibleTasks = tasks.filter((t) => taskIds.has(t.id));
  const items = [
    ...scopedSteps.map((s) => ({
      id: `step:${s.id}`,
      completed: s.is_completed,
    })),
    ...visibleTasks.map((t) => ({
      id: `task:${t.id}`,
      completed: t.status === "concluido",
    })),
  ];
  return {
    total: items.length,
    done: items.filter((i) => i.completed).length,
    items,
  };
}
