import type { Lead } from "@/types";

export function canonicalLeadKey(lead: Pick<Lead, "id" | "canonical_lead_id">) {
  return lead.canonical_lead_id || lead.id;
}

/** Mantém uma linha por identidade, preferindo o registro canônico original. */
export function dedupeCanonicalLeads<T extends Lead>(leads: T[]): T[] {
  const unique = new Map<string, T>();
  for (const lead of leads) {
    const key = canonicalLeadKey(lead);
    const current = unique.get(key);
    if (!current || (current.is_pipeline_copy && !lead.is_pipeline_copy)) {
      unique.set(key, lead);
    }
  }
  return Array.from(unique.values());
}

export function countCanonicalLeads(leads: Lead[]) {
  return new Set(leads.map(canonicalLeadKey)).size;
}
