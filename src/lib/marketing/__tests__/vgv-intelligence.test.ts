import { describe, expect, it } from "vitest";
import { calculateCampaignRows, calculateSaleCommissions, calculateVgvCustomMetrics, calculateVgvIntelligence, normalizeVgvCustomFields, relateCampaignPerformanceToSales } from "@/lib/marketing/vgv-intelligence";

describe("VGV intelligence", () => {
  it("calcula funil comercial e participação sobre a comissão do cliente", () => {
    const result = calculateVgvIntelligence([
      { sale_value: 500000, commission_percentage: 5, agency_share_percentage: 20, include_agency_commission: true },
      { sale_value: 300000, commission_percentage: 5, agency_share_percentage: 20, include_agency_commission: false },
    ] as never, [{ spend: 4000, leads: 80 }] as never);
    expect(result).toMatchObject({ totalVgv: 800000, grossCommission: 40000, agencyCommission: 5000, spend: 4000, leads: 80, cpl: 50, cac: 2000, conversionRate: 2.5, roas: 200, commercialRoi: 900 });
  });

  it("aplica a porcentagem da Comissão Genesy sobre a comissão comercial", () => {
    expect(calculateSaleCommissions({ sale_value: 500000, commission_percentage: 5, agency_share_percentage: 20, include_agency_commission: true })).toEqual({ grossCommission: 25000, genesyCommission: 5000 });
    expect(calculateSaleCommissions({ sale_value: 500000, commission_percentage: 5, agency_share_percentage: 20, include_agency_commission: false }).genesyCommission).toBe(0);
  });

  it("normaliza perguntas extras e só leva números ao dashboard", () => {
    expect(normalizeVgvCustomFields([{ label: "Renda", type: "number", include_in_dashboard: true }, { label: "Observação", type: "text", include_in_dashboard: true }])).toEqual([
      { id: "campo_1", label: "Renda", type: "number", required: false, include_in_dashboard: true },
      { id: "campo_2", label: "Observação", type: "text", required: false, include_in_dashboard: false },
    ]);
  });

  it("calcula o ROI por campanha sobre a comissão bruta e tolera diferenças de caixa", () => {
    const rows = calculateCampaignRows([
      { agency_client_id: "client-1", campaign_name: "Campanha Verão", sale_value: 500000, commission_percentage: 5 },
    ] as never, [
      { agency_client_id: "client-1", campaign_name: " campanha verão ", client_name: "Cliente", spend: 5000, leads: 50 },
    ] as never);
    expect(rows[0]).toMatchObject({ grossCommission: 25000, commercialRoi: 400, cpl: 100, cac: 5000, conversionRate: 2, roas: 100 });
  });

  it("não cria campanha a partir do texto livre informado pelo cliente", () => {
    const rows = calculateCampaignRows([
      { agency_client_id: "client-1", campaign_name: "Campanha lembrada pelo corretor", sale_value: 500000, commission_percentage: 5 },
    ] as never, []);
    expect(rows).toEqual([]);
  });

  it("relaciona os totais da campanha à venda mesmo quando a campanha terminou antes do mês da venda", () => {
    const registered = [
      { id: "campaign-1", agency_client_id: "client-1", campaign_name: "Campanha Verão", spend: 2500, leads: 50 },
      { id: "campaign-2", agency_client_id: "client-1", campaign_name: "Outra campanha", spend: 900, leads: 10 },
    ] as never;
    const related = relateCampaignPerformanceToSales(registered, [], [
      { agency_client_id: "client-1", campaign_name: " campanha verão " },
    ] as never);
    expect(related).toEqual([registered[0]]);
    expect(calculateVgvIntelligence([{ sale_value: 500000, commission_percentage: 5 }] as never, related)).toMatchObject({ spend: 2500, leads: 50, cpl: 50, cac: 2500, conversionRate: 2, roas: 200, commercialRoi: 900 });
  });

  it("soma campos numéricos configurados para o dashboard", () => {
    const metrics = calculateVgvCustomMetrics([
      { custom_fields: [{ id: "parcelas", label: "Parcelas", type: "number", required: false, include_in_dashboard: true }] },
    ] as never, [
      { custom_answers: { parcelas: 12 } }, { custom_answers: { parcelas: "18" } },
    ] as never);
    expect(metrics).toEqual([{ id: "parcelas", label: "Parcelas", value: 30 }]);
  });
});
