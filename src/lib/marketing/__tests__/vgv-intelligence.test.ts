import { describe, expect, it } from "vitest";
import { calculateCampaignRows, calculateVgvCustomMetrics, calculateVgvIntelligence, normalizeVgvCustomFields } from "@/lib/marketing/vgv-intelligence";

describe("VGV intelligence", () => {
  it("calcula funil comercial e participação sobre a comissão do cliente", () => {
    const result = calculateVgvIntelligence([
      { sale_value: 500000, commission_percentage: 5, agency_share_percentage: 20, include_agency_commission: true },
      { sale_value: 300000, commission_percentage: 5, agency_share_percentage: 20, include_agency_commission: false },
    ] as never, [{ spend: 4000, leads: 80 }] as never);
    expect(result).toMatchObject({ totalVgv: 800000, grossCommission: 40000, agencyCommission: 5000, spend: 4000, leads: 80, cpl: 50, cac: 2000, conversionRate: 2.5, roas: 200, commercialRoi: 900 });
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
    expect(rows[0]).toMatchObject({ grossCommission: 25000, commercialRoi: 400, cpl: 100, cac: 5000 });
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
