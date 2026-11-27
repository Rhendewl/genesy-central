import { describe, expect, it } from "vitest";
import type { Lead, LeadOrigin } from "@/types";
import { analyzeOrigins, resolveOrigin } from "../origin-analytics";

const origins: LeadOrigin[] = [
  { id: "o-ig", user_id: "u", name: "Instagram", slug: "instagram_automation", color: "#db2777", is_default: false, created_at: "", updated_at: "" },
  { id: "o-meta", user_id: "u", name: "Meta Lead Ads", slug: "meta_lead_ads", color: "#1877f2", is_default: false, created_at: "", updated_at: "" },
];

const stages = [
  { id: "novo", pipeline_id: "p", order_index: 0, is_active: true, name: "Novo" },
  { id: "reuniao", pipeline_id: "p", order_index: 1, is_active: true, name: "Reunião", metric_type: "meeting_scheduled" },
  { id: "venda", pipeline_id: "p", order_index: 2, is_active: true, name: "Venda", is_won: true },
  { id: "perdido", pipeline_id: "p", order_index: 3, is_active: true, name: "Perdido", is_lost: true },
];

function lead(id: string, extra: Partial<Lead>): Lead {
  return {
    id, user_id: "u", name: id, contact: "", email: null, source: "manual", origin_id: null, page_id: null, leadgen_id: null,
    campaign_name: null, ad_name: null, form_id: null, form_name: null, is_duplicate: false, kanban_column: "novo_lead",
    pipeline_id: "p", stage_id: "novo", assigned_to: null, tags: [], notes: null, integration_notes: null, deal_value: 0,
    entered_at: "2026-11-20", received_at: "2026-11-20T15:00:00Z", created_at: "2026-11-20T15:00:00Z", updated_at: "", iq_score: null, ie_score: null,
    ...extra,
  } as Lead;
}

describe("analyzeOrigins", () => {
  const leads = [
    lead("a", { origin_id: "o-ig", stage_id: "venda", deal_value: 1000, iq_score: 80, campaign_name: "Campanha X" }),
    lead("b", { origin_id: "o-ig", stage_id: "perdido" }),
    lead("c", { origin_id: "o-ig", stage_id: "novo", received_at: "2026-11-22T15:00:00Z" }),
    lead("d", { source: "meta_lead_ads", stage_id: "novo", campaign_name: "Campanha Y" }),
    lead("e", { source: "indicacao_amigo" }),
  ];
  const history = [{ lead_id: "b", stage_id: "reuniao", pipeline_id: "p", moved_at: "2026-11-21T10:00:00Z" }];
  const result = analyzeOrigins({ leads, stages, history, origins, firstContactMs: new Map([["a", 60_000], ["b", 180_000]]) });

  it("agrupa por origem cadastrada, com fallback pelo slug e nome legível", () => {
    expect(result.rows.map(r => r.name)).toEqual(["Instagram", "Meta Lead Ads", "Indicacao Amigo"]);
    expect(result.rows[0]).toMatchObject({ leads: 3, share: 60, color: "#db2777" });
  });

  it("mede reunião e venda pelo histórico de etapas, receita e tempo de atendimento", () => {
    const ig = result.rows[0];
    expect(ig.meetings).toBe(2);     // a (venda) e b (passou pela reunião)
    expect(ig.sales).toBe(1);
    expect(ig.lost).toBe(1);
    expect(ig.saleRate).toBe(33.3);
    expect(ig.revenue).toBe(1000);
    expect(ig.avgIq).toBe(80);
    expect(ig.medianFirstContactMs).toBe(120_000);
    expect(ig.campaigns[0]).toEqual({ name: "Campanha X", leads: 1, sales: 1 });
  });

  it("monta a chegada diária preenchendo os dias sem leads", () => {
    expect(result.timelineUnit).toBe("day");
    expect(result.timeline.map(p => p.key)).toEqual(["2026-11-20", "2026-11-21", "2026-11-22"]);
    expect(result.timeline[0].counts["o-ig"]).toBe(2);
  });

  it("resolve origem por id antes do slug", () => {
    expect(resolveOrigin({ origin_id: "o-meta", source: "manual" }, origins).name).toBe("Meta Lead Ads");
  });
});
