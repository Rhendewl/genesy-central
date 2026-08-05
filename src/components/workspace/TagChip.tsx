"use client";

import { useTags } from "@/hooks/useTags";
import { semanticChipStyle } from "@/lib/semantic-chip";

// Chip visual extraído de src/components/crm/LeadCard.tsx — mesma receita,
// agora compartilhada entre CRM e Workspace.
export function TagChip({ tagId }: { tagId: string }) {
  const { tags } = useTags();
  const tag = tags.find((t) => t.id === tagId);
  if (!tag) return null;

  return (
    <span
      className="lc-semantic-chip rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none"
      style={semanticChipStyle(tag.color)}
    >
      {tag.name}
    </span>
  );
}
