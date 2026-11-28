/**
 * Perfil do lead (quem é o cliente): Corretor, Imobiliária ou
 * Construtora/Incorporadora. Preenchido automaticamente pelo banco a partir da
 * pergunta "Você é" / "Perfil" dos formulários (migration
 * 20261128120000_crm_lead_perfil.sql) ou escolhido manualmente no lead.
 */
export type LeadPerfil = "corretor" | "imobiliaria" | "construtora";

export const LEAD_PERFIS: { value: LeadPerfil; label: string; color: string }[] = [
  { value: "corretor", label: "Corretor", color: "#38bdf8" },
  { value: "imobiliaria", label: "Imobiliária", color: "#a78bfa" },
  { value: "construtora", label: "Construtora/Incorporadora", color: "#f59e0b" },
];

export const SEM_PERFIL_LABEL = "Sem perfil";

export function isLeadPerfil(value: unknown): value is LeadPerfil {
  return LEAD_PERFIS.some(perfil => perfil.value === value);
}

export function leadPerfilInfo(value: string | null | undefined) {
  return LEAD_PERFIS.find(perfil => perfil.value === value) ?? null;
}

export function leadPerfilLabel(value: string | null | undefined) {
  return leadPerfilInfo(value)?.label ?? SEM_PERFIL_LABEL;
}

const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLocaleLowerCase("pt-BR").trim().replace(/\s+/g, " ");

const SEARCH_TERMS: Record<string, LeadPerfil> = {
  corretor: "corretor", corretora: "corretor", corretores: "corretor", corretoras: "corretor",
  imobiliaria: "imobiliaria", imobiliarias: "imobiliaria",
  construtora: "construtora", construtoras: "construtora",
  incorporadora: "construtora", incorporadoras: "construtora",
  "construtora/incorporadora": "construtora", "construtora incorporadora": "construtora",
};

/**
 * Quando a busca é exatamente o nome de um perfil ("Corretor", "imobiliárias"…)
 * a barra de pesquisa filtra por perfil em vez de procurar no nome — o nome do
 * lead costuma levar o nome do formulário ("João | Form Corretores").
 */
export function perfilFromSearch(query: string): LeadPerfil | null {
  return SEARCH_TERMS[normalize(query)] ?? null;
}
