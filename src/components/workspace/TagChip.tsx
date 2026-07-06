"use client";

import { useTags } from "@/hooks/useTags";

// Chip visual extraído de src/components/crm/LeadCard.tsx — mesma receita,
// agora compartilhada entre CRM e Workspace.
export function TagChip({ tagId }: { tagId: string }) {
  const { tags } = useTags();
  const tag = tags.find((t) => t.id === tagId);
  if (!tag) return null;

  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-medium leading-none"
      style={{
        background: `${tag.color}18`,
        color:      tag.color,
        border:     `1px solid ${tag.color}28`,
      }}
    >
      {tag.name}
    </span>
  );
}
