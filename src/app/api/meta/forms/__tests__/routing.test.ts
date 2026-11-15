// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ context: vi.fn(), from: vi.fn(), forms: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/supabase-server", () => ({ createServerSupabaseClient: async () => ({ from: mocks.from }) }));
vi.mock("@/lib/marketing/server", async (original) => ({ ...await original<object>(), getMarketingServerContext: mocks.context }));
vi.mock("@/lib/crypto", () => ({ decryptToken: () => "token" }));
vi.mock("@/lib/meta-api", () => ({ getLeadGenForms: mocks.forms }));
import { POST } from "../toggle/route";
import { GET } from "../route";
const request = (patch = {}) => new NextRequest("https://test.local", { method: "POST", body: JSON.stringify({ pageId: "111", formId: "222", active: true, pipelineId: "pipeline", stageId: "stage", ...patch }) });
let rows: Record<string, unknown>;
beforeEach(() => {
  vi.clearAllMocks(); mocks.context.mockResolvedValue({ isAdmin: true, user: { id: "owner" } }); mocks.forms.mockResolvedValue([{ id: "222", name: "Cadastro" }]); mocks.save.mockResolvedValue({ error: null });
  rows = { meta_page_subscriptions: { encrypted_page_token: "encrypted", is_active: true }, crm_stages: { id: "stage" } };
  mocks.from.mockImplementation((table: string) => { const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: rows[table] ?? null }), upsert: mocks.save, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows[table] ?? null }).then(resolve) }; return chain; });
});
it("blocks members before reading connections", async () => { mocks.context.mockResolvedValue({ isAdmin: false }); expect((await POST(request())).status).toBe(403); expect(mocks.from).not.toHaveBeenCalled(); });
it("refuses an unowned page", async () => { rows.meta_page_subscriptions = null; expect((await POST(request())).status).toBe(404); expect(mocks.forms).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled(); });
it("refuses unavailable or cross-owner stages", async () => { rows.crm_stages = null; expect((await POST(request())).status).toBe(400); expect(mocks.save).not.toHaveBeenCalled(); });
it("checks that the requested form belongs to the page", async () => { mocks.forms.mockResolvedValue([{ id: "other", name: "Other" }]); expect((await POST(request())).status).toBe(400); expect(mocks.save).not.toHaveBeenCalled(); });
it("saves the selected destination using server-verified form name", async () => { expect((await POST(request())).status).toBe(200); expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ user_id: "owner", crm_pipeline_id: "pipeline", crm_stage_id: "stage", form_name: "Cadastro", is_active: true }), { onConflict: "user_id,form_id" }); });
it("requires a complete destination before activating", async () => { expect((await POST(request({ stageId: null }))).status).toBe(400); expect(mocks.save).not.toHaveBeenCalled(); });

it("rejects an unavailable assignee", async () => { expect((await POST(request({ assignedTo: "other-member" }))).status).toBe(400); expect(mocks.save).not.toHaveBeenCalled(); });
it("saves an active account member as assignee", async () => { rows.user_profiles = { id: "member", auth_user_id: "auth-member" }; expect((await POST(request({ assignedTo: "member" }))).status).toBe(200); expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ assigned_to: "member" }), expect.anything()); });

it("persists the business value with cent precision", async () => {
  expect((await POST(request({ dealValue: 450000.756 }))).status).toBe(200);
  expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ crm_deal_value: 450000.76 }), expect.anything());
});
it("allows clearing a previously configured business value", async () => {
  expect((await POST(request({ dealValue: 0 }))).status).toBe(200);
  expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ crm_deal_value: 0 }), expect.anything());
});
it.each([-1, "450000", null, 1_000_000_000_000])("rejects invalid business value %s", async (dealValue) => {
  expect((await POST(request({ dealValue }))).status).toBe(400);
  expect(mocks.save).not.toHaveBeenCalled();
});
it("preserves configured values for clients that omit the business value", async () => {
  await POST(request());
  expect(mocks.save.mock.calls[0][0]).not.toHaveProperty("crm_deal_value");
});
it("returns the saved business value when reloading forms, defaulting unconfigured forms to zero", async () => {
  rows.meta_form_subscriptions = [{ form_id: "222", crm_deal_value: "450000.75", is_active: true }];
  mocks.forms.mockResolvedValue([{ id: "222", name: "Cadastro" }, { id: "333", name: "Outro" }]);
  const response = await GET(new NextRequest("https://test.local/api/meta/forms?pageId=111"));
  expect(response.status).toBe(200);
  expect((await response.json()).forms).toEqual([
    expect.objectContaining({ id: "222", crm_deal_value: 450000.75 }),
    expect.objectContaining({ id: "333", crm_deal_value: 0 }),
  ]);
});
