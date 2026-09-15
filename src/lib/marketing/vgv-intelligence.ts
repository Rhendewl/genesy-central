import type { MarketingVgvCampaignPerformance, MarketingVgvCustomField, MarketingVgvForm, MarketingVgvSale } from "@/types/marketing";

export function normalizeVgvCustomFields(value: unknown): MarketingVgvCustomField[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, 20).flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const label = String(item.label ?? "").trim().slice(0, 120);
    if (!label) return [];
    let id = String(item.id ?? `campo_${index + 1}`).trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 80);
    if (!id || seen.has(id)) id = `campo_${index + 1}`;
    seen.add(id);
    const type = item.type === "number" ? "number" as const : "text" as const;
    return [{ id, label, type, required: item.required === true, include_in_dashboard: type === "number" && item.include_in_dashboard === true }];
  });
}

export function calculateVgvIntelligence(sales: MarketingVgvSale[], performance: MarketingVgvCampaignPerformance[]) {
  const totalVgv = sales.reduce((sum, sale) => sum + Number(sale.sale_value), 0);
  const grossCommission = sales.reduce((sum, sale) => sum + Number(sale.sale_value) * Number(sale.commission_percentage) / 100, 0);
  const agencyCommission = sales.reduce((sum, sale) => sum + (sale.include_agency_commission
    ? Number(sale.sale_value) * Number(sale.commission_percentage) / 100 * Number(sale.agency_share_percentage) / 100
    : 0), 0);
  const spend = performance.reduce((sum, row) => sum + Number(row.spend), 0);
  const leads = performance.reduce((sum, row) => sum + Number(row.leads), 0);
  const count = sales.length;
  return {
    totalVgv,
    count,
    averageTicket: count ? totalVgv / count : 0,
    grossCommission,
    agencyCommission,
    spend,
    leads,
    cpl: leads ? spend / leads : 0,
    cac: count ? spend / count : 0,
    conversionRate: leads ? count / leads * 100 : 0,
    roas: spend ? totalVgv / spend : 0,
    commercialRoi: spend ? (grossCommission - spend) / spend * 100 : 0,
  };
}

export function calculateCampaignRows(sales: MarketingVgvSale[], performance: MarketingVgvCampaignPerformance[]) {
  const normalizeCampaign = (value: string) => value.trim().toLocaleLowerCase("pt-BR");
  const keyFor = (clientId: string, campaignName: string) => `${clientId}\u0000${normalizeCampaign(campaignName)}`;
  const keys = new Set([...performance.map((row) => keyFor(row.agency_client_id, row.campaign_name)), ...sales.filter((sale) => sale.agency_client_id && sale.campaign_name).map((sale) => keyFor(sale.agency_client_id!, sale.campaign_name!))]);
  return Array.from(keys).map((key) => {
    const [clientId, normalizedCampaignName] = key.split("\u0000");
    const campaignSales = sales.filter((sale) => sale.agency_client_id === clientId && sale.campaign_name && normalizeCampaign(sale.campaign_name) === normalizedCampaignName);
    const campaignMedia = performance.filter((row) => row.agency_client_id === clientId && normalizeCampaign(row.campaign_name) === normalizedCampaignName);
    const spend = campaignMedia.reduce((sum, row) => sum + row.spend, 0);
    const leads = campaignMedia.reduce((sum, row) => sum + row.leads, 0);
    const vgv = campaignSales.reduce((sum, sale) => sum + sale.sale_value, 0);
    const grossCommission = campaignSales.reduce((sum, sale) => sum + sale.sale_value * sale.commission_percentage / 100, 0);
    const salesCount = campaignSales.length;
    const campaignName = campaignMedia[0]?.campaign_name ?? campaignSales[0]?.campaign_name ?? normalizedCampaignName;
    return { key, clientId, clientName: campaignMedia[0]?.client_name ?? "Cliente", campaignName, spend, leads, sales: salesCount, vgv, grossCommission, cpl: leads ? spend / leads : 0, cac: salesCount ? spend / salesCount : 0, conversionRate: leads ? salesCount / leads * 100 : 0, roas: spend ? vgv / spend : 0, commercialRoi: spend ? (grossCommission - spend) / spend * 100 : 0 };
  }).sort((a, b) => b.vgv - a.vgv || b.spend - a.spend);
}

export function calculateVgvCustomMetrics(forms: MarketingVgvForm[], sales: MarketingVgvSale[]) {
  const fields = new Map<string, MarketingVgvCustomField>();
  for (const form of forms) {
    for (const field of form.custom_fields) {
      if (field.type === "number" && field.include_in_dashboard) fields.set(field.id, field);
    }
  }
  return Array.from(fields.values()).map((field) => ({
    id: field.id,
    label: field.label,
    value: sales.reduce((sum, sale) => sum + (Number(sale.custom_answers?.[field.id]) || 0), 0),
  }));
}
