import { describe, expect, it } from "vitest";
import { instagramReport } from "@/lib/marketing/instagram-report";
import type { MarketingInstagramAccountTotals, MarketingInstagramMedia } from "@/types/marketing";

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

  it("prioriza o alcance único da conta sem somar o alcance das publicações", () => {
    const account: MarketingInstagramAccountTotals = {
      reach: 120, views: 410, profile_views: 28, accounts_engaged: 36, total_interactions: 52,
      likes: 40, comments: 4, shares: 3, saves: 5, profile_links_taps: 7, follower_count: 1800,
    };
    const result = instagramReport([media({ reach: 100 }), media({ reach: 90 })], account);
    expect(result.totals.reach).toBe(120);
    expect(result.contentTotals.reach).toBe(190);
    expect(result.engagementRate).toBe(30);
  });

  it("separa formatos e preserva alcance e quantidade por categoria", () => {
    const result = instagramReport([
      media({ id: "static", media_type: "IMAGE", media_product_type: "FEED", reach: 40 }),
      media({ id: "carousel", media_type: "CAROUSEL_ALBUM", reach: 70 }),
      media({ id: "reel", media_type: "VIDEO", media_product_type: "REELS", reach: 90 }),
    ]);
    expect(result.formats).toEqual([
      { name: "Estático", publications: 1, reach: 40 },
      { name: "Carrossel", publications: 1, reach: 70 },
      { name: "Reels", publications: 1, reach: 90 },
    ]);
  });

  it("usa interações do conteúdo quando a série diária da conta não as detalha", () => {
    const result = instagramReport([media({ published_at: "2026-08-02T12:00:00Z", total_interactions: 20 })], null, [{
      insight_date: "2026-08-02", reach: 300, views: 500, profile_views: 20, accounts_engaged: 15,
      total_interactions: 0, likes: 0, comments: 0, shares: 0, saves: 0, profile_links_taps: 0, follower_count: 2,
    }]);
    expect(result.daily[0].interactions).toBe(20);
    expect(result.daily[0].followers).toBe(2);
  });

  it("preserva saldo negativo quando os unfollows superam os novos seguidores", () => {
    const result = instagramReport([], null, [{
      insight_date: "2026-07-27", reach: 0, views: 0, profile_views: 0, accounts_engaged: 0,
      total_interactions: 0, likes: 0, comments: 0, shares: 0, saves: 0, profile_links_taps: 0, follower_count: -1,
    }]);
    expect(result.daily[0].followers).toBe(-1);
  });
});
