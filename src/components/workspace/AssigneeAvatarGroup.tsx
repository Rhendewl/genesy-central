"use client";

import { AssigneeAvatar } from "./AssigneeAvatar";

interface AssigneeAvatarGroupProps {
  assigneeIds: string[];
  size?:       number;
  max?:        number;
}

export function AssigneeAvatarGroup({ assigneeIds, size = 20, max = 3 }: AssigneeAvatarGroupProps) {
  if (assigneeIds.length === 0) return null;

  const visible = assigneeIds.slice(0, max);
  const overflow = assigneeIds.length - visible.length;

  return (
    <div className="flex flex-shrink-0 items-center" style={{ paddingLeft: 4 }}>
      {visible.map((id, i) => (
        <div key={id} style={{ marginLeft: i === 0 ? 0 : -6 }}>
          <AssigneeAvatar assigneeId={id} size={size} />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="flex flex-shrink-0 items-center justify-center rounded-full text-[9px] font-semibold"
          style={{ width: size, height: size, marginLeft: -6, background: "var(--hover)", color: "var(--text-title)" }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
