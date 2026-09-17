import { describe, expect, it } from "vitest";
import { aggregateTrafficReport, buildTrafficReportCampaignOptions, defaultTrafficReportCampaignIds, trafficReportFilename } from "../traffic-report";

describe("traffic report", () => {
  it("lists campaigns in the period and selects by default only those with leads", () => {
    const campaigns = [
      { id: "a", name: "Campanha A", status: "ativa" },
      { id: "b", name: "Campanha B", status: "pausada" },
      { id: "c", name: "Sem veiculação", status: "pausada" },
    ];
    const options = buildTrafficReportCampaignOptions(campaigns, [
      { campaign_id: "a", spend: 500, leads: 8, impressions: 1000, reach: 800, clicks: 50, conversions: 0 },
      { campaign_id: "b", spend: 200, leads: 0, impressions: 600, reach: 500, clicks: 10, conversions: 0 },
    ]);

    expect(options.map((campaign) => campaign.id)).toEqual(["a", "b"]);
    expect(defaultTrafficReportCampaignIds(options)).toEqual(["a"]);
  });

  it("aggregates primary metrics and ranks campaigns", () => {
    const report = aggregateTrafficReport({
      clientName: "Cliente",
      since: "2026-09-01",
      until: "2026-09-10",
      campaigns: [{ id: "a", name: "Campanha A", status: "ativa" }, { id: "b", name: "Campanha B", status: "pausada" }],
      metrics: [
        { campaign_id: "a", spend: 400, leads: 10, impressions: 10000, reach: 8000, clicks: 200, link_clicks: 150, conversions: 2 },
        { campaign_id: "b", spend: 300, leads: 5, impressions: 5000, reach: 4000, clicks: 100, link_clicks: 50, conversions: 1 },
      ],
    });
    expect(report.metrics).toMatchObject({ spend: 700, leads: 15, cpl: 700 / 15, ctr: 200 / 15000 * 100, clicks: 200, activeCampaigns: 1 });
    expect(report.campaigns.map((campaign) => campaign.id)).toEqual(["a", "b"]);
  });

  it("creates a safe stable filename", () => {
    expect(trafficReportFilename("Gênese Imóveis", "2026-09-01", "2026-09-10")).toBe("relatorio-trafego-pago-genese-imoveis-2026-09-01-a-2026-09-10.pdf");
  });

  it("preserva campanhas diferentes no ranking", () => {
    const report = aggregateTrafficReport({
      clientName: "Cliente",
      since: "2026-09-01",
      until: "2026-09-30",
      campaigns: [
        { id: "a", name: "A", status: "ativa" },
        { id: "b", name: "B", status: "ativa" },
      ],
      metrics: [
        { campaign_id: "a", spend: 100, leads: 5, impressions: 1000, reach: 900, clicks: 20, conversions: 1 },
        { campaign_id: "b", spend: 90, leads: 4, impressions: 900, reach: 800, clicks: 18, conversions: 1 },
      ],
    });
    expect(report.campaigns.map((campaign) => campaign.id)).toEqual(["a", "b"]);
  });

  it("consolida variações técnicas pelo nome legível do imóvel no PDF", () => {
    const report = aggregateTrafficReport({
      clientName: "Cliente",
      since: "2026-09-01",
      until: "2026-09-30",
      campaigns: [
        { id: "a", name: "[VITA M. CATARINA] - [PORT] - [FORM EXT]", status: "ativa" },
        { id: "b", name: "[VITA M. CATARINA] - [BN] - [FORM EXT]", status: "pausada" },
      ],
      metrics: [
        { campaign_id: "a", spend: 400, leads: 10, impressions: 10000, reach: 8000, clicks: 200, conversions: 2 },
        { campaign_id: "b", spend: 300, leads: 5, impressions: 5000, reach: 4000, clicks: 100, conversions: 1 },
      ],
      campaignDisplayNames: { a: "Vita M. Catarina", b: "Vita M. Catarina" },
    });

    expect(report.campaigns).toHaveLength(1);
    expect(report.campaigns[0]).toMatchObject({ name: "Vita M. Catarina", spend: 700, leads: 15, cpl: 700 / 15, impressions: 15000, clicks: 300 });
  });
});
