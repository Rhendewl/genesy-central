import { describe, expect, it } from "vitest";
import { aggregateTrafficReport, trafficReportFilename } from "../traffic-report";

describe("traffic report", () => {
  it("aggregates primary metrics and ranks campaigns", () => {
    const report = aggregateTrafficReport({
      clientName: "Cliente",
      since: "2026-09-01",
      until: "2026-09-10",
      campaigns: [{ id: "a", name: "Campanha A", status: "ativa", thumbnail_url: "data:image/png;base64,a" }, { id: "b", name: "Campanha B", status: "pausada" }],
      metrics: [
        { campaign_id: "a", spend: 400, leads: 10, impressions: 10000, reach: 8000, clicks: 200, link_clicks: 150, conversions: 2 },
        { campaign_id: "b", spend: 300, leads: 5, impressions: 5000, reach: 4000, clicks: 100, link_clicks: 50, conversions: 1 },
      ],
    });
    expect(report.metrics).toMatchObject({ spend: 700, leads: 15, cpl: 700 / 15, ctr: 200 / 15000 * 100, clicks: 200, activeCampaigns: 1 });
    expect(report.campaigns.map((campaign) => campaign.id)).toEqual(["a", "b"]);
    expect(report.creatives.map((campaign) => campaign.id)).toEqual(["a"]);
  });

  it("creates a safe stable filename", () => {
    expect(trafficReportFilename("Gênese Imóveis", "2026-09-01", "2026-09-10")).toBe("relatorio-trafego-pago-genese-imoveis-2026-09-01-a-2026-09-10.pdf");
  });
});
