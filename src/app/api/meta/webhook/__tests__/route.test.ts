// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createHmac } from "crypto";
const mocks = vi.hoisted(() => ({ process: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/meta-lead-capture", () => ({ processMetaLeadEvent: mocks.process }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminSupabaseClient: () => ({ from: mocks.from }) }));
import { POST, GET } from "../route";
const payload = JSON.stringify({ object: "page", entry: [{ changes: [{ field: "leadgen", value: { page_id: "111", form_id: "222", leadgen_id: "333" } }] }] });
function request(signature?: string) { return new NextRequest("https://test.local", { method: "POST", body: payload, headers: signature ? { "x-hub-signature-256": signature } : {} }); }
const signed = () => request(`sha256=${createHmac("sha256", "secret").update(payload).digest("hex")}`);
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("META_APP_SECRET", "secret"); vi.stubEnv("META_VERIFY_TOKEN", "verify");
  const chain = { select: () => chain, eq: () => chain, then: (resolve: (data: unknown) => unknown) => Promise.resolve({ data: [{ user_id: "owner" }] }).then(resolve) }; mocks.from.mockReturnValue(chain); mocks.process.mockResolvedValue({ status: "processed" });
});
afterEach(() => vi.unstubAllEnvs());
it("rejects missing and invalid signatures before any database operation", async () => { expect((await POST(request())).status).toBe(401); expect((await POST(request("sha256=invalid"))).status).toBe(401); expect(mocks.from).not.toHaveBeenCalled(); });
it("fails closed if the signing secret is absent", async () => { vi.stubEnv("META_APP_SECRET", ""); expect((await POST(request())).status).toBe(503); expect(mocks.from).not.toHaveBeenCalled(); });
it("awaits capture before acknowledging delivery", async () => { expect((await POST(signed())).status).toBe(200); expect(mocks.process).toHaveBeenCalledWith(expect.anything(), { page_id: "111", form_id: "222", leadgen_id: "333" }, "owner"); });
it("asks Meta to retry instead of acknowledging a failed capture", async () => { mocks.process.mockRejectedValue(new Error("database unavailable")); expect((await POST(signed())).status).toBe(503); });
it("verifies only the configured webhook token", async () => { expect((await GET(new NextRequest("https://test.local?hub.mode=subscribe&hub.challenge=challenge&hub.verify_token=verify"))).status).toBe(200); expect((await GET(new NextRequest("https://test.local?hub.mode=subscribe&hub.challenge=challenge&hub.verify_token=wrong"))).status).toBe(403); });
