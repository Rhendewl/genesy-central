import { describe, expect, it } from "vitest";
import { leadPerfilLabel, perfilFromSearch } from "../lead-perfil";
import { matchesLeadSearch } from "../lead-search";
import { EMPTY_LEAD_FILTERS, NONE, countActiveFilters, filterOptionCounts, matchesLeadFilters } from "../lead-filters";
import { campaignPerfilMatrix, perfilBreakdown } from "../perfil-analytics";
import type { Lead } from "@/types";

const lead = (patch: Partial<Lead>): Lead => ({
  id: "x", user_id: "u", name: "Lead", contact: "85999990000", email: null, source: "manual", origin_id: null,
  page_id: null, leadgen_id: null, campaign_name: null, ad_name: null, form_id: null, form_name: null,
  is_duplicate: false, kanban_column: "novo_lead", pipeline_id: "p", stage_id: "s", assigned_to: null, tags: [],
  perfil: null, notes: null, integration_notes: null, deal_value: 0, entered_at: "2026-11-28",
  created_at: "2026-11-28", updated_at: "2026-11-28", iq_score: null, ie_score: null, ...patch,
});

describe("perfil do lead", () => {
  it("reconhece o perfil digitado na busca, com ou sem acento e no plural", () => {
    expect(perfilFromSearch("Corretor")).toBe("corretor");
    expect(perfilFromSearch(" corretoras ")).toBe("corretor");
    expect(perfilFromSearch("Imobiliárias")).toBe("imobiliaria");
    expect(perfilFromSearch("incorporadora")).toBe("construtora");
    expect(perfilFromSearch("Construtora/Incorporadora")).toBe("construtora");
    expect(perfilFromSearch("Corretor João")).toBeNull();
    expect(leadPerfilLabel("construtora")).toBe("Construtora/Incorporadora");
    expect(leadPerfilLabel(null)).toBe("Sem perfil");
  });

  it("busca por perfil não confunde com o nome do formulário", () => {
    const fromCorretorForm = { name: "Ana | Form Corretores", contact: "1", perfil: "imobiliaria" as const };
    expect(matchesLeadSearch(fromCorretorForm, "Corretor")).toBe(false);
    expect(matchesLeadSearch(fromCorretorForm, "Imobiliária")).toBe(true);
    expect(matchesLeadSearch(fromCorretorForm, "Form Corretores")).toBe(true);
  });

  it("filtros: OU dentro da categoria, E entre categorias, com 'sem valor'", () => {
    const corretorAna = lead({ perfil: "corretor", assigned_to: "ana", tags: ["t1"] });
    const semPerfil = lead({ assigned_to: null, campaign_name: "Black Friday" });
    const filters = { ...EMPTY_LEAD_FILTERS, perfis: ["corretor", NONE] };
    expect(matchesLeadFilters(corretorAna, filters)).toBe(true);
    expect(matchesLeadFilters(semPerfil, filters)).toBe(true);
    expect(matchesLeadFilters(lead({ perfil: "construtora" }), filters)).toBe(false);
    expect(matchesLeadFilters(corretorAna, { ...filters, responsaveis: [NONE] })).toBe(false);
    expect(matchesLeadFilters(semPerfil, { ...filters, responsaveis: [NONE], campanhas: ["Black Friday"] })).toBe(true);
    expect(matchesLeadFilters(corretorAna, { ...EMPTY_LEAD_FILTERS, tags: ["t2", "t1"] })).toBe(true);
    expect(matchesLeadFilters(lead({ source: "site_guia_impulsionar" }), { ...EMPTY_LEAD_FILTERS, origens: ["source:site_guia_impulsionar"] })).toBe(true);
    expect(countActiveFilters({ ...filters, tags: ["t1"] })).toBe(3);
    expect(filterOptionCounts([corretorAna, semPerfil, lead({ perfil: "corretor" })], "perfis"))
      .toEqual([{ value: "corretor", count: 2 }, { value: NONE, count: 1 }]);
  });

  it("métricas por perfil e cruzamento campanha × perfil", () => {
    const leads = [
      lead({ id: "1", perfil: "corretor", campaign_name: "Guia" }),
      lead({ id: "2", perfil: "corretor", campaign_name: "Guia" }),
      lead({ id: "3", perfil: "imobiliaria", campaign_name: "Guia" }),
      lead({ id: "4", campaign_name: "Guia" }),
      lead({ id: "5", perfil: "construtora", campaign_name: "Lançamentos" }),
    ];
    const won = new Set(["1"]);
    const rows = perfilBreakdown(leads, item => item.id !== "5", item => won.has(item.id));
    expect(rows.map(row => [row.perfil, row.total, row.pct, row.saleRate])).toEqual([
      ["corretor", 2, 40, 50], ["imobiliaria", 1, 20, 0], ["construtora", 1, 20, 0], ["sem_perfil", 1, 20, 0],
    ]);
    expect(perfilBreakdown([lead({ perfil: "corretor" })], () => false, () => false).some(row => row.perfil === "sem_perfil")).toBe(false);
    const matrix = campaignPerfilMatrix(leads, item => ({ key: item.campaign_name!, label: item.campaign_name! }));
    expect(matrix[0]).toMatchObject({ label: "Guia", total: 4, counts: { corretor: 2, imobiliaria: 1, construtora: 0, sem_perfil: 1 }, topPerfil: "corretor", topPct: 67 });
    expect(matrix[1]).toMatchObject({ label: "Lançamentos", topPerfil: "construtora", topPct: 100 });
  });
});
