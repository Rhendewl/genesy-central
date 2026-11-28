import type { Lead } from "@/types";
import { perfilFromSearch } from "@/lib/crm/lead-perfil";
const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim().replace(/\s+/g, " ");
export function matchesLeadSearch(lead: Pick<Lead, "name" | "contact"> & { perfil?: Lead["perfil"] }, query: string) {
  const term = normalize(query);
  if (!term) return true;
  const perfil = perfilFromSearch(query);
  if (perfil) return lead.perfil === perfil;
  if (normalize(lead.name || "").includes(term)) return true;
  const digits = query.replace(/\D/g, "");
  return /^[+\d\s().-]+$/.test((lead.contact || "").trim()) && /^[+\d\s().-]+$/.test(query.trim()) && digits.length > 0 && (lead.contact || "").replace(/\D/g, "").includes(digits);
}
