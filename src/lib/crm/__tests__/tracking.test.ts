import { describe, expect, it } from "vitest";
import type { Lead } from "@/types";
import { analyzeSegments } from "../origin-analytics";
import { buildTrackingInsights, channelOf, trackingResolvers, trafficOf, type LeadAttribution } from "../tracking";

const base = (id: string, extra: Partial<Lead> = {}) => ({
  id, source: "formulario_genesy", origin_id: null, leadgen_id: null, stage_id: "novo", pipeline_id: "p", kanban_column: "novo_lead",
  deal_value: 0, iq_score: null, received_at: "2026-11-20T12:00:00Z", created_at: "2026-11-20T12:00:00Z", campaign_name: null, ad_name: null, form_name: null, ...extra,
}) as unknown as Lead;

const session = (extra: Partial<LeadAttribution>): LeadAttribution => ({
  channel: "form", device: "mobile", browser: "Instagram", os: "iOS", utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null, referrer: null, ad_click: false, ...extra,
});

describe("rastreamento de leads", () => {
  it("define o canal pela UTM, pelo referrer ou pelo próprio lead", () => {
    expect(channelOf(base("a"), session({ utm_source: "ig" }))).toBe("instagram");
    expect(channelOf(base("a"), session({ referrer: "https://go.genesycompany.com/x" }))).toBe("links");
    expect(channelOf(base("a", { source: "meta_lead_ads", leadgen_id: "1" }))).toBe("meta_form");
    expect(channelOf(base("a", { source: "manual" }))).toBe("sem_rastreio");
  });

  it("separa anúncio, orgânico, direto e sem rastreio", () => {
    expect(trafficOf(base("a"), session({ utm_source: "fb", utm_campaign: "Campanha" }))).toBe("pago");
    expect(trafficOf(base("a"), session({ referrer: "https://instagram.com/" }))).toBe("organico");
    expect(trafficOf(base("a"), session({}))).toBe("direto");
    expect(trafficOf(base("a", { source: "manual" }))).toBe("sem_rastreio");
  });

  it("cruza campanha da UTM com a do Meta e mede conversão por canal", () => {
    const leads = [
      base("a", { stage_id: "venda" }),
      base("b"),
      base("c", { source: "meta_lead_ads", leadgen_id: "x", campaign_name: "Lead Ads Áurea" }),
    ];
    const attribution = { a: session({ utm_source: "ig", utm_campaign: "%5BJardim%5D+Est%C3%A1ticos" }), b: session({ utm_source: "ig" }) };
    const r = trackingResolvers(attribution);
    const stages = [{ id: "novo", pipeline_id: "p", order_index: 0, is_active: true }, { id: "venda", pipeline_id: "p", order_index: 1, is_active: true, is_won: true }];
    const channel = analyzeSegments({ leads, stages, history: [] }, r.channel);
    expect(channel.rows[0]).toMatchObject({ key: "instagram", leads: 2, sales: 1, saleRate: 50 });
    const campaign = analyzeSegments({ leads, stages, history: [] }, r.campaign);
    expect(campaign.rows.map(row => row.name).sort()).toEqual(["Lead Ads Áurea", "[Jardim] Estáticos"]);
    const device = analyzeSegments({ leads, stages, history: [] }, r.device);
    expect(device.total).toBe(2);
  });

  it("avisa quando poucos leads têm rastreio", () => {
    const empty = { rows: [], total: 0, hasStageMetrics: true, timeline: [], timelineUnit: "day" as const };
    const insights = buildTrackingInsights({ origin: empty, channel: empty, traffic: empty, campaign: empty, device: empty, totalLeads: 20, trackedLeads: 4 });
    expect(insights.map(i => i.id)).toContain("coverage");
  });
});
