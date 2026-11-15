import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aggregateTrafficReport } from "../traffic-report";
import { createTrafficReportPdf } from "../traffic-report-pdf";

const logo = `data:image/png;base64,${readFileSync("public/brand/verified-badge.png").toString("base64")}`;
const assets = {
  logoDark: logo, logoLight: logo,
  lightFont: readFileSync("public/brand/tt-firs-neue-light.ttf").toString("base64"),
  mediumFont: readFileSync("public/brand/tt-firs-neue-medium.ttf").toString("base64"),
};

describe("traffic report PDF", () => {
  it("prints all twelve campaigns on additional pages without truncating the ranking", () => {
    const campaigns = Array.from({ length: 12 }, (_, index) => ({ id: `campaign-${index}`, name: `Campanha ${index + 1}`, status: "ativa" }));
    const report = aggregateTrafficReport({ clientName: "Urban Exalt", since: "2026-11-01", until: "2026-11-06", campaigns, metrics: campaigns.map((campaign) => ({ campaign_id: campaign.id, spend: 10, leads: 1, impressions: 100, reach: 80, clicks: 5, conversions: 0 })) });
    const pdf = createTrafficReportPdf(report, assets);
    expect(pdf.getNumberOfPages()).toBe(5);
    expect(pdf.output("arraybuffer").byteLength).toBeGreaterThan(10_000);
  });
});
