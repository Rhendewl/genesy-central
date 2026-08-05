import { describe, expect, it } from "vitest";
import { instagramReport } from "@/lib/marketing/instagram-report";
import type { MarketingInstagramMedia } from "@/types/marketing";

const media = (values: Partial<MarketingInstagramMedia>): MarketingInstagramMedia => ({
  id: "1", connection_id: "c", marketing_content_id: null, instagram_media_id: "ig", media_type: "IMAGE",
  media_product_type: "FEED", caption: null, media_url: null, thumbnail_url: null, permalink: null,
  published_at: "2026-08-02T12:00:00Z", reach: 100, views: 120, plays: 0, likes: 10, comments: 2,
  saved: 3, shares: 5, total_interactions: 20, average_watch_time: 0, total_watch_time: 0,
  last_synced_at: "2026-08-02T13:00:00Z", ...values,
});

describe("instagramReport", () => {
  it("soma os indicadores e ordena os melhores conteúdos", () => {
    const result = instagramReport([media({ id: "a" }), media({ id: "b", reach: 50, total_interactions: 30 })]);
    expect(result.totals.reach).toBe(150);
    expect(result.totals.interactions).toBe(50);
    expect(result.best[0].id).toBe("b");
    expect(result.engagementRate).toBeCloseTo(33.333, 2);
  });

  it("usa plays quando views não estiver disponível", () => {
    expect(instagramReport([media({ views: 0, plays: 80 })]).totals.views).toBe(80);
  });
});
