import type { Lead } from "@/types";

function timestamp(value?: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * O RPC de movimentação atualiza `updated_at`. Ordenar por esse campo mantém
 * o lead recém-arrastado no topo da etapa inclusive depois do realtime/refetch.
 */
export function sortLeadsByRecentActivity(leads: Lead[]): Lead[] {
  return [...leads].sort((a, b) => {
    const recentDifference = timestamp(b.updated_at) - timestamp(a.updated_at);
    if (recentDifference !== 0) return recentDifference;
    return timestamp(b.created_at) - timestamp(a.created_at);
  });
}
