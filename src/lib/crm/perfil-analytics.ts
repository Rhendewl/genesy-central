import type { Lead } from "@/types";
import { LEAD_PERFIS, SEM_PERFIL_LABEL, type LeadPerfil } from "@/lib/crm/lead-perfil";

export type PerfilKey = LeadPerfil | "sem_perfil";

export interface PerfilBreakdownRow {
  perfil: PerfilKey;
  label: string;
  color: string;
  total: number;
  /** % do total de leads do período. */
  pct: number;
  reunioes: number;
  vendas: number;
  meetingRate: number;
  saleRate: number;
}

export interface CampaignPerfilRow {
  key: string;
  label: string;
  total: number;
  counts: Record<PerfilKey, number>;
  /** Perfil mais frequente entre os leads com perfil (null se nenhum tem perfil). */
  topPerfil: LeadPerfil | null;
  /** % do perfil mais frequente sobre os leads com perfil. */
  topPct: number;
}

const SEM_PERFIL_COLOR = "#94a3b8";
export const PERFIL_KEYS: PerfilKey[] = [...LEAD_PERFIS.map(perfil => perfil.value), "sem_perfil"];

const keyOf = (lead: Pick<Lead, "perfil">): PerfilKey => lead.perfil ?? "sem_perfil";
const pct = (part: number, whole: number) => whole ? Math.round(part / whole * 100) : 0;
const emptyCounts = (): Record<PerfilKey, number> => ({ corretor: 0, imobiliaria: 0, construtora: 0, sem_perfil: 0 });

/** Leads, reuniões e vendas por perfil. "Sem perfil" só aparece quando existe. */
export function perfilBreakdown<T extends Pick<Lead, "perfil">>(
  leads: T[], isMeeting: (lead: T) => boolean, isWon: (lead: T) => boolean,
): PerfilBreakdownRow[] {
  return PERFIL_KEYS.map(perfil => {
    const group = leads.filter(lead => keyOf(lead) === perfil);
    const info = LEAD_PERFIS.find(item => item.value === perfil);
    const reunioes = group.filter(isMeeting).length;
    const vendas = group.filter(isWon).length;
    return {
      perfil, label: info?.label ?? SEM_PERFIL_LABEL, color: info?.color ?? SEM_PERFIL_COLOR,
      total: group.length, pct: pct(group.length, leads.length),
      reunioes, vendas, meetingRate: pct(reunioes, group.length), saleRate: pct(vendas, group.length),
    };
  }).filter(row => row.perfil !== "sem_perfil" || row.total > 0);
}

/**
 * Cruzamento Campanha × Perfil: para cada campanha (ou formulário/origem quando
 * o lead não veio de anúncio) quantos leads de cada perfil chegaram.
 */
export function campaignPerfilMatrix<T extends Pick<Lead, "perfil">>(
  leads: T[], campaignOf: (lead: T) => { key: string; label: string },
): CampaignPerfilRow[] {
  const rows = new Map<string, CampaignPerfilRow>();
  for (const lead of leads) {
    const { key, label } = campaignOf(lead);
    const row = rows.get(key) ?? { key, label, total: 0, counts: emptyCounts(), topPerfil: null, topPct: 0 };
    row.total += 1;
    row.counts[keyOf(lead)] += 1;
    rows.set(key, row);
  }
  return Array.from(rows.values()).map(row => {
    const withPerfil = row.total - row.counts.sem_perfil;
    const top = LEAD_PERFIS.map(perfil => perfil.value).sort((a, b) => row.counts[b] - row.counts[a])[0];
    return withPerfil ? { ...row, topPerfil: top, topPct: pct(row.counts[top], withPerfil) } : row;
  }).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "pt-BR"));
}
