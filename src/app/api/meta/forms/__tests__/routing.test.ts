// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ context: vi.fn(), from: vi.fn(), forms: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/supabase-server", () => ({ createServerSupabaseClient: async () => ({ from: mocks.from }) }));
vi.mock("@/lib/marketing/server", async (original) => ({ ...await original<object>(), getMarketingServerContext: mocks.context }));
vi.mock("@/lib/crypto", () => ({ decryptToken: () => "token" }));
vi.mock("@/lib/meta-api", () => ({ getLeadGenForms: mocks.forms }));
import { POST } from "../toggle/route";
const request = (patch = {}) => new NextRequest("https://test.local", { method: "POST", body: JSON.stringify({ pageId: "111", formId: "222", active: true, pipelineId: "pipeline", stageId: "stage", ...patch }) });
let rows: Record<string, unknown>;
beforeEach(() => {
  vi.clearAllMocks(); mocks.context.mockResolvedValue({ isAdmin: true, user: { id: "owner" } }); mocks.forms.mockResolvedValue([{ id: "222", name: "Cadastro" }]); mocks.save.mockResolvedValue({ error: null });
  rows = { meta_page_subscriptions: { encrypted_page_token: "encrypted", is_active: true }, crm_stages: { id: "stage" } };
  mocks.from.mockImplementation((table: string) => { const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: rows[table] ?? null }), upsert: mocks.save }; return chain; });
});
it("blocks members before reading connections", async () => { mocks.context.mockResolvedValue({ isAdmin: false }); expect((await POST(request())).status).toBe(403); expect(mocks.from).not.toHaveBeenCalled(); });
it("refuses an unowned page", async () => { rows.meta_page_subscriptions = null; expect((await POST(request())).status).toBe(404); expect(mocks.forms).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled(); });
it("refuses unavailable or cross-owner stages", async () => { rows.crm_stages = null; expect((await POST(request())).status).toBe(400); expect(mocks.save).not.toHaveBeenCalled(); });
it("checks that the requested form belongs to the page", async () => { mocks.forms.mockResolvedValue([{ id: "other", name: "Other" }]); expect((await POST(request())).status).toBe(400); expect(mocks.save).not.toHaveBeenCalled(); });
it("saves the selected destination using server-verified form name", async () => { expect((await POST(request())).status).toBe(200); expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ user_id: "owner", crm_pipeline_id: "pipeline", crm_stage_id: "stage", form_name: "Cadastro", is_active: true }), { onConflict: "user_id,form_id" }); });
it("requires a complete destination before activating", async () => { expect((await POST(request({ stageId: null }))).status).toBe(400); expect(mocks.save).not.toHaveBeenCalled(); });

it("rejects an unavailable assignee", async () => { expect((await POST(request({ assignedTo: "other-member" }))).status).toBe(400); expect(mocks.save).not.toHaveBeenCalled(); });
it("saves an active account member as assignee", async () => { rows.user_profiles = { id: "member", auth_user_id: "auth-member" }; expect((await POST(request({ assignedTo: "member" }))).status).toBe(200); expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ assigned_to: "member" }), expect.anything()); });
