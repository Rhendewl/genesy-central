"use client";

import { WORKSPACE_TASK_PRIORITIES, type WorkspaceTaskPriority } from "@/types/workspace";
import { semanticChipStyle } from "@/lib/semantic-chip";

export function PriorityBadge({ priority }: { priority: WorkspaceTaskPriority }) {
  const meta = WORKSPACE_TASK_PRIORITIES.find((p) => p.id === priority);
  if (!meta) return null;

  return (
    <span
      className="lc-semantic-chip inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none"
      style={semanticChipStyle(meta.color)}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}
