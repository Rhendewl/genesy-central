import { describe, expect, it } from "vitest";
import type { LeadTiming } from "../operation-analytics";
import { buildCommercialInsights } from "../commercial-insights";

const NOW = Date.parse("2026-11-27T15:00:00Z");
const timing = (id: string, assigned: string | null, openSince?: string): LeadTiming => ({
  lead: { id, assigned_to: assigned } as never, arrival: "2026-11-20T12:00:00Z", firstAdvanceAt: null, firstAdvanceMs: null,
  waiting: false, waitingSince: null, transitions: [],
  visits: openSince ? [{ stageId: "s", enteredAt: openSince, exitedAt: null, durationMs: NOW - Date.parse(openSince) }] : [],
});

describe("buildCommercialInsights", () => {
  const timings = Array.from({ length: 10 }, (_, i) => timing(`l${i}`, i < 3 ? null : "p1", i < 4 ? "2026-11-10T12:00:00Z" : undefined));
  const items = buildCommercialInsights({
    timings, slaMinutes: 5, withinSla: 20, firstContact: { count: 6, median: 3_600_000, p90: 7_200_000 },
    waiting: 4, overdue: 3, oldestWaitingMs: 2 * 86_400_000,
    slowest: { name: "Imóvel pendente", ms: 5 * 86_400_000, current: 2 },
    team: [{ name: "Simone", medianMs: 600_000, measured: 4, waiting: 0 }, { name: "Diogo", medianMs: 6 * 3_600_000, measured: 3, waiting: 2 }],
    arrivals: { night: 6, day: 6, nightMedianMs: 8 * 3_600_000, dayMedianMs: 1_800_000 },
    conversion: { leads: 10, meetings: 2, sales: 1, revenue: 5000, hasStageMetrics: true },
    now: NOW, formatMoney: v => `R$ ${v}`,
  });
  const byId = Object.fromEntries(items.map(i => [i.id, i]));

  it("coloca o urgente primeiro e limita a seis cards", () => {
    expect(items[0]).toMatchObject({ id: "queue", tone: "critical", value: "3 leads" });
    expect(items.length).toBeLessThanOrEqual(6);
    expect(byId.sla).toMatchObject({ tone: "critical", value: "20%" });
  });

  it("resume conversão, gargalo e equipe com o número em destaque", () => {
    expect(byId.conversion).toMatchObject({ value: "20%", tone: "good" });
    expect(byId.conversion?.detail).toContain("R$ 5000");
    expect(byId.bottleneck?.title).toContain("Imóvel pendente");
  });

  it("aponta leads parados, sem responsável e demora à noite", () => {
    const all = buildCommercialInsights({
      timings, slaMinutes: 5, withinSla: null, firstContact: { count: 0, median: null, p90: null }, waiting: 0, overdue: 0, oldestWaitingMs: null,
      team: [], arrivals: { night: 6, day: 6, nightMedianMs: 8 * 3_600_000, dayMedianMs: 1_800_000 },
      conversion: { leads: 10, meetings: 0, sales: 0, revenue: 0, hasStageMetrics: false }, now: NOW,
    }).map(i => i.id);
    expect(all).toEqual(expect.arrayContaining(["stale", "unassigned", "night"]));
  });

  it("avisa quando não há leads", () => {
    expect(buildCommercialInsights({ timings: [], slaMinutes: 5, withinSla: null, firstContact: { count: 0, median: null, p90: null }, waiting: 0, overdue: 0, oldestWaitingMs: null, team: [], arrivals: { night: 0, day: 0, nightMedianMs: null, dayMedianMs: null }, conversion: { leads: 0, meetings: 0, sales: 0, revenue: 0, hasStageMetrics: true } })[0].id).toBe("empty");
  });
});
