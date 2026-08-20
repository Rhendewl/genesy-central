import { describe, expect, it } from "vitest";
import { buildCommercialAnalysis, calculateCommercialMetrics } from "../commercial-analysis-engine";
import type { CommercialAnalysisInput } from "@/types/commercial-analysis";

const data = (overrides: Partial<CommercialAnalysisInput> = {}): CommercialAnalysisInput => ({
  client_id: "client", meeting_date: "2026-08-20", period_start: "2026-08-13", period_end: "2026-08-20", participants: null,
  leads_received: 100, leads_contacted: 90, leads_responded: 45, leads_no_response: 45,
  qualified_leads: 18, disqualified_leads: 27, hot_leads: 5, warm_leads: 8, cold_leads: 5,
  product_type: "residential_mid", development_name: "Residencial Sol",
  meetings_scheduled: 9, meetings_held: 6, no_shows: 3, rescheduled_meetings: 0, qualified_meetings: 5,
  proposals_sent: 4, sales_closed: 2, revenue: 400000, lost_sales: 2,
  response_notes: null, lead_profile_notes: null, meeting_notes: null, loss_reasons: null,
  wins: null, blockers: null, decisions: null, next_actions: null, ...overrides,
});

describe("commercial analysis engine", () => {
  it("calcula as taxas sem misturar resposta com contato", () => {
    const metrics = calculateCommercialMetrics(data());
    expect(metrics.contactRate).toBe(90);
    expect(metrics.responseRate).toBe(50);
    expect(metrics.noResponseRate).toBe(50);
    expect(metrics.attendanceRate).toBeCloseTo(66.7);
    expect(metrics.averageTicket).toBe(200000);
  });

  it("não produz NaN quando não há volume", () => {
    const result = buildCommercialAnalysis(data({ leads_received: 0, leads_contacted: 0, leads_responded: 0, meetings_scheduled: 0, meetings_held: 0, sales_closed: 0, revenue: 0 }));
    expect(result.score).toBe(0);
    expect(Object.values(result.metrics).every(Number.isFinite)).toBe(true);
  });

  it("identifica melhora de conversão contra o período anterior", () => {
    const result = buildCommercialAnalysis(data({ sales_closed: 3 }), data({ sales_closed: 1 }));
    expect(result.insights.find((item) => item.id === "trend")?.status).toBe("good");
  });
});
