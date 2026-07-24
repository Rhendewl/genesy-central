import { describe, expect, it } from "vitest";
import { countCanonicalLeads, dedupeCanonicalLeads } from "../lead-identity";
import type { Lead } from "@/types";

function lead(id: string, canonicalLeadId: string, isCopy: boolean): Lead {
  return {
    id, canonical_lead_id: canonicalLeadId, is_pipeline_copy: isCopy, copied_from_lead_id: isCopy ? canonicalLeadId : null,
    user_id: "owner", name: id, contact: "", email: null, source: "manual", page_id: null,
    leadgen_id: null, campaign_name: null, ad_name: null, form_id: null, form_name: null,
    is_duplicate: false, kanban_column: "abordados", pipeline_id: "pipeline", stage_id: "stage",
    assigned_to: null, tags: [], notes: null, integration_notes: null, deal_value: 0,
    entered_at: "2026-07-21", created_at: "2026-07-21", updated_at: "2026-07-21",
    iq_score: null, ie_score: null,
  };
}

describe("identidade canônica de leads", () => {
  it("conta original e cópia como um único lead", () => {
    expect(countCanonicalLeads([lead("root", "root", false), lead("copy", "root", true)])).toBe(1);
  });

  it("prefere o registro original ao consolidar dados globais", () => {
    const result = dedupeCanonicalLeads([lead("copy", "root", true), lead("root", "root", false)]);
    expect(result.map((item) => item.id)).toEqual(["root"]);
  });
});
