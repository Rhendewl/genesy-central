// @vitest-environment node
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const run = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase-admin", () => ({ createAdminSupabaseClient: () => ({}) }));
vi.mock("@/lib/marketing/instagram-scheduler", () => ({ runScheduledInstagramPost: run }));
vi.mock("@/lib/marketing/editorial-instagram", () => ({ syncInstagramEditorial: vi.fn(async () => 0) }));
import { GET } from "../route";
const secret = "test-only-vault-secret";
const hash = createHash("sha256").update(secret).digest("hex");
const request = (value?: string) => new NextRequest("https://test.local", { headers: value ? { "x-cron-secret": value } : {} });
describe("Instagram scheduled worker authorization", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("CRON_SECRET", ""); vi.stubEnv("INSTAGRAM_SCHEDULER_SECRET_SHA256", hash); run.mockResolvedValue({ processed: 0 }); });
  afterEach(() => vi.unstubAllEnvs());
  it("accepts the existing Vault secret with a hash configured on the server", async () => {
    expect((await GET(request(secret))).status).toBe(200); expect(run).toHaveBeenCalledOnce();
  });
  it("does not accept the hash itself as an authentication credential", async () => {
    expect((await GET(request(hash))).status).toBe(401); expect(run).not.toHaveBeenCalled();
  });
  it("rejects missing or incorrect credentials", async () => {
    expect((await GET(request())).status).toBe(401); expect((await GET(request("wrong"))).status).toBe(401); expect(run).not.toHaveBeenCalled();
  });
  it("retains compatibility with CRON_SECRET", async () => {
    vi.stubEnv("CRON_SECRET", "test-legacy"); expect((await GET(request("test-legacy"))).status).toBe(200);
  });
});
