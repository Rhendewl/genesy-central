import type { Lead } from "@/types";

/** Valor usado nas listas de filtro para "sem valor" (sem perfil, sem responsável…). */
export const NONE = "__none__";

export interface LeadFilters {
  perfis: string[];
  responsaveis: string[];
  origens: string[];
  campanhas: string[];
  formularios: string[];
  tags: string[];
}

export type LeadFilterKey = keyof LeadFilters;

export const EMPTY_LEAD_FILTERS: LeadFilters = {
  perfis: [], responsaveis: [], origens: [], campanhas: [], formularios: [], tags: [],
};

type FilterableLead = Pick<Lead, "assigned_to" | "origin_id" | "source" | "campaign_name" | "form_name" | "tags"> & { perfil?: Lead["perfil"] };

/** Origem: a cadastrada (origin_id) ou, sem ela, o source (ex.: landing pages do site). */
export function leadOriginKey(lead: Pick<Lead, "origin_id" | "source">) {
  return lead.origin_id ? `origin:${lead.origin_id}` : lead.source ? `source:${lead.source}` : NONE;
}

const text = (value: string | null | undefined) => value?.trim() || NONE;

export function leadFilterValues(lead: FilterableLead, key: LeadFilterKey): string[] {
  switch (key) {
    case "perfis": return [lead.perfil ?? NONE];
    case "responsaveis": return [lead.assigned_to ?? NONE];
    case "origens": return [leadOriginKey(lead)];
    case "campanhas": return [text(lead.campaign_name)];
    case "formularios": return [text(lead.form_name)];
    case "tags": return lead.tags?.length ? lead.tags : [NONE];
  }
}

/** Mesma categoria: qualquer valor marcado (OU). Categorias diferentes: todas (E). */
export function matchesLeadFilters(lead: FilterableLead, filters: LeadFilters) {
  return (Object.keys(filters) as LeadFilterKey[]).every(key => {
    const selected = filters[key];
    if (!selected.length) return true;
    return leadFilterValues(lead, key).some(value => selected.includes(value));
  });
}

export function countActiveFilters(filters: LeadFilters) {
  return Object.values(filters).reduce((total, values) => total + values.length, 0);
}

/** Valores presentes nos leads, com a contagem de cada um, do mais frequente ao menos. */
export function filterOptionCounts(leads: FilterableLead[], key: LeadFilterKey) {
  const counts = new Map<string, number>();
  for (const lead of leads) {
    for (const value of Array.from(new Set(leadFilterValues(lead, key)))) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));
}
