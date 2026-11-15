import type { Lead } from "@/types";
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim().replace(/\s+/g, " ");
export function matchesLeadSearch(lead: Pick<Lead, "name" | "contact">, query: string) {
  const term = normalize(query);
  if (!term) return true;
  if (normalize(lead.name || "").includes(term)) return true;
  const digits = query.replace(/\D/g, "");
  return /^[+\d\s().-]+$/.test((lead.contact || "").trim()) && /^[+\d\s().-]+$/.test(query.trim()) && digits.length > 0 && (lead.contact || "").replace(/\D/g, "").includes(digits);
}
