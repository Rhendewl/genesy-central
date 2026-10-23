// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({ createLead: vi.fn(), fetchLead: vi.fn() }));
vi.mock("@/lib/crypto", () => ({ decryptToken: () => "token" }));
vi.mock("@/lib/meta-leads", () => ({ fetchMetaLead: mocks.fetchLead }));
vi.mock("@/lib/crm/lead-service", () => ({ LeadService: class { createLead = mocks.createLead; } }));
import { captureMetaLead, resolveFormRoute, type FormRoute } from "@/lib/meta-lead-capture";
const active: FormRoute = { form_id: "333", form_name: "Cadastro", is_active: true, crm_pipeline_id: "pipeline", crm_stage_id: "stage" };
const event = { page_id: "111", leadgen_id: "222", form_id: "333" };
function database(responses: Record<string, unknown[]>) {
  const filters: unknown[][] = [];
  return { filters, db: { from: (table: string) => {
    const result = responses[table]?.shift() ?? { data: null };
    const chain = { select: () => chain, eq: (...args: unknown[]) => { filters.push([table, ...args]); return chain; }, order: () => chain, limit: () => chain,
      maybeSingle: async () => result, then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) };
    return chain;
  } } as unknown as SupabaseClient };
}
describe("Meta lead routing", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.createLead.mockResolvedValue({ ok: true, leadId: "lead" });
    mocks.fetchLead.mockResolvedValue({ full_name: "Ana", first_name: "Ana", phone: "85999999999", email: "ana@example.test", campaign_name: "Campanha", ad_name: "Anúncio", custom_fields: [{ label: "Interesses", value: "Casa; Apartamento" }], answers: [{ name: "interesses", values: ["Casa", "Apartamento"] }] });
  });
  it("keeps explicitly paused forms paused even if no forms remain active", () => {
    expect(resolveFormRoute([{ ...active, is_active: false }], "333").capture).toBe(false);
    expect(resolveFormRoute([active], "444").capture).toBe(false);
    expect(resolveFormRoute([active], "333").capture).toBe(true);
    expect(resolveFormRoute([], "333").capture).toBe(false);
    expect(resolveFormRoute([], "333", true).capture).toBe(true);
  });
  it("creates a lead in the selected stage with every answer and source metadata", async () => {
    const { db, filters } = database({ meta_page_subscriptions: [{ data: { encrypted_page_token: "encrypted" } }], meta_form_subscriptions: [{ data: [active] }], leads: [{ data: null }], crm_stages: [{ data: { id: "stage" } }] });
    expect(await captureMetaLead(db, event, "owner")).toMatchObject({ status: "processed", lead_id: "lead" });
    expect(mocks.createLead).toHaveBeenCalledWith(expect.objectContaining({ user_id: "owner", stageId: "stage", name: "Ana", contact: "85999999999", leadgen_id: "222", meta_form_answers: [{ name: "interesses", values: ["Casa", "Apartamento"] }], integration_notes: expect.stringContaining("Casa; Apartamento") }));
    expect(filters).toContainEqual(["crm_stages", "crm_pipelines.user_id", "owner"]);
  });
  it("never retrieves or inserts an already captured event", async () => {
    const { db } = database({ meta_page_subscriptions: [{ data: { encrypted_page_token: "encrypted" } }], meta_form_subscriptions: [{ data: [active] }], leads: [{ data: { id: "existing" } }] });
    expect(await captureMetaLead(db, event, "owner")).toMatchObject({ status: "duplicate" }); expect(mocks.fetchLead).not.toHaveBeenCalled(); expect(mocks.createLead).not.toHaveBeenCalled();
  });
  it("refuses an unavailable or cross-owner destination before fetching personal data", async () => {
    const { db } = database({ meta_page_subscriptions: [{ data: { encrypted_page_token: "encrypted" } }], meta_form_subscriptions: [{ data: [active] }], leads: [{ data: null }], crm_stages: [{ data: null }] });
    await expect(captureMetaLead(db, event, "owner")).rejects.toThrow("não está disponível"); expect(mocks.fetchLead).not.toHaveBeenCalled();
  });
  it("recognizes a concurrent successful insert instead of retrying another insertion", async () => {
    mocks.createLead.mockResolvedValue({ ok: false, error: "unique constraint" });
    const { db } = database({ meta_page_subscriptions: [{ data: { encrypted_page_token: "encrypted" } }], meta_form_subscriptions: [{ data: [active] }], leads: [{ data: null }, { data: { id: "concurrent" } }], crm_stages: [{ data: { id: "stage" } }] });
    expect(await captureMetaLead(db, event, "owner")).toMatchObject({ status: "duplicate", lead_id: "concurrent" }); expect(mocks.createLead).toHaveBeenCalledTimes(1);
  });
});
