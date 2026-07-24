import { describe, expect, it } from "vitest";
import { createCrmReportPdf } from "@/lib/crm-report-pdf";
import type { CrmActivity, CrmReportResponse } from "@/types/crm-reports";

function activity(index: number): CrmActivity {
  return {
    id: String(index), lead_id: `lead-${index}`, pipeline_id: "pipeline", stage_id: "stage",
    actor_user_id: "actor", assigned_to: "assignee", event_type: "stage_changed",
    lead_name: `EMPRESA ${index}`, lead_contact: null, source: "Indicação", deal_value: 0,
    from_stage_name: "novo_lead", to_stage_name: "Dia 01 Ligação", note_content: null,
    metadata: {}, occurred_at: `2026-07-17T15:${String(index % 60).padStart(2, "0")}:00.000Z`,
    actor_name: "Clarice", assignee_name: "Clarice", pipeline_name: "Comercial",
  };
}

function reportWith(total: number): CrmReportResponse {
  const activities = Array.from({ length: total }, (_, index) => activity(index));
  return {
    period: { from: "2026-07-17T00:00:00.000Z", to: "2026-07-17T23:59:59.999Z" },
    summary: { totalActivities: total, leadsCreated: 0, leadsWorked: total, stageMovements: total, dealsWon: 0, dealsLost: 0, wonValue: 0, averageTicket: 0, conversionRate: 0, notesAdded: 0 },
    activities,
    byStage: total ? [{ id: "stage", label: "Dia 01 Ligação", activities: total, leads: total, wins: 0, value: 0 }] : [],
    byAssignee: [{ id: "assignee", label: "Clarice", activities: total, leads: total, wins: 0, value: 0 }],
    bySource: [],
    options: { pipelines: [{ id: "pipeline", name: "Comercial" }], assignees: [{ id: "assignee", name: "Clarice" }] },
  };
}

describe("createCrmReportPdf", () => {
  it("gera um PDF paginado para relatorios extensos", () => {
    const pdf = createCrmReportPdf({
      report: reportWith(40),
      from: new Date("2026-07-17T00:00:00-03:00"),
      to: new Date("2026-07-17T23:59:59-03:00"),
      generatedAt: new Date("2026-07-17T18:23:00-03:00"),
      includeNotes: true,
      pipelineLabel: "Todas as pipelines",
      assigneeLabel: "Todos os responsáveis",
    });

    expect(pdf.getNumberOfPages()).toBeGreaterThan(1);
    expect(pdf.output("arraybuffer").byteLength).toBeGreaterThan(10_000);
  });

  it("gera normalmente quando nao ha atividades", () => {
    const pdf = createCrmReportPdf({
      report: reportWith(0), from: new Date("2026-07-17"), to: new Date("2026-07-17"), includeNotes: false,
    });

    expect(pdf.getNumberOfPages()).toBe(1);
    expect(pdf.output("arraybuffer").byteLength).toBeGreaterThan(1_000);
  });
});
