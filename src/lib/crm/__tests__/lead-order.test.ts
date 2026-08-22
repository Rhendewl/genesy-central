import { describe, expect, it } from "vitest";
import { sortLeadsByRecentActivity } from "@/lib/crm/lead-order";
import type { Lead } from "@/types";

function lead(id: string, updatedAt: string, createdAt = updatedAt): Lead {
  return {
    id,
    user_id: "owner",
    name: id,
    contact: "",
    email: null,
    source: "manual",
    origin_id: null,
    page_id: null,
    leadgen_id: null,
    campaign_name: null,
    ad_name: null,
    form_id: null,
    form_name: null,
    is_duplicate: false,
    kanban_column: "novo_lead",
    pipeline_id: "pipeline",
    stage_id: "stage",
    assigned_to: null,
    tags: [],
    notes: null,
    integration_notes: null,
    deal_value: 0,
    entered_at: "2026-07-29",
    created_at: createdAt,
    updated_at: updatedAt,
    iq_score: null,
    ie_score: null,
  };
}

describe("sortLeadsByRecentActivity", () => {
  it("posiciona primeiro o lead movimentado mais recentemente", () => {
    const older = lead("antigo", "2026-07-29T12:00:00.000Z");
    const moved = lead("movido", "2026-07-29T15:00:00.000Z");

    expect(sortLeadsByRecentActivity([older, moved]).map(item => item.id))
      .toEqual(["movido", "antigo"]);
  });

  it("não altera o array recebido", () => {
    const original = [
      lead("antigo", "2026-07-29T12:00:00.000Z"),
      lead("movido", "2026-07-29T15:00:00.000Z"),
    ];

    sortLeadsByRecentActivity(original);
    expect(original.map(item => item.id)).toEqual(["antigo", "movido"]);
  });
});
