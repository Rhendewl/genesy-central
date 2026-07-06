"use client";

import { useUsers } from "@/hooks/useUsers";

export function AssigneeAvatar({ assigneeId, size = 20 }: { assigneeId: string | null; size?: number }) {
  const { profiles } = useUsers();
  if (!assigneeId) return null;

  const profile = profiles.find((p) => p.id === assigneeId);
  if (!profile) return null;

  return (
    <div
      title={profile.full_name}
      className="flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-semibold"
      style={{ width: size, height: size, background: "#b0b8c1", color: "#000000" }}
    >
      {profile.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.avatar_url} alt={profile.full_name} className="h-full w-full object-cover" />
      ) : (
        profile.full_name.slice(0, 1).toUpperCase()
      )}
    </div>
  );
}
