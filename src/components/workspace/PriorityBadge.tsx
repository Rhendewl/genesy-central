"use client";

import { WORKSPACE_TASK_PRIORITIES, type WorkspaceTaskPriority } from "@/types/workspace";

export function PriorityBadge({ priority }: { priority: WorkspaceTaskPriority }) {
  const meta = WORKSPACE_TASK_PRIORITIES.find((p) => p.id === priority);
  if (!meta) return null;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium leading-none"
      style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}28` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}
