// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ context: vi.fn(), from: vi.fn(), admin: vi.fn(), sync: vi.fn() }));
vi.mock("@/lib/supabase-server", () => ({ createServerSupabaseClient: async () => ({ from: mocks.from }) }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminSupabaseClient: mocks.admin }));
vi.mock("@/lib/marketing/server", async (original) => ({ ...await original<object>(), getMarketingServerContext: mocks.context }));
vi.mock("@/lib/instagram-sync", async (original) => ({ ...await original<object>(), syncInstagramConnection: mocks.sync }));
import { POST } from "../route";
import { instagramSyncErrorMessage } from "@/lib/instagram-sync";

const request = () => new NextRequest("https://test.local/api/marketing/instagram/sync", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId: "account" }),
});
const account = { id: "account", organization_id: "org", instagram_user_id: "ig", encrypted_access_token: "encrypted", token_expires_at: null };
let chain: { select: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn>; single: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };

describe("Instagram synchronization authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.context.mockResolvedValue({ isAdmin: true, organizationId: "org" });
    mocks.admin.mockReturnValue({ serviceOnly: true });
    mocks.sync.mockResolvedValue({ mediaSynced: 1 });
    chain = { select: vi.fn(), eq: vi.fn(), single: vi.fn(), update: vi.fn() };
    chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain); chain.update.mockReturnValue(chain);
    chain.single.mockResolvedValue({ data: account, error: null });
    mocks.from.mockReturnValue(chain);
  });

  it("authorizes and scopes the account before using the service-only publication ledger", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(chain.eq).toHaveBeenCalledWith("organization_id", "org");
    expect(mocks.sync).toHaveBeenCalledWith({ serviceOnly: true }, account);
  });

  it("does not elevate or write errors for non-administrators", async () => {
    mocks.context.mockResolvedValue({ isAdmin: false, organizationId: "org" });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it("does not elevate or mutate an account outside the authorized lookup", async () => {
    chain.single.mockResolvedValue({ data: null, error: null });
    expect((await POST(request())).status).toBe(404);
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(chain.update).not.toHaveBeenCalled();
  });

  it("preserves database error messages and scopes the error update", async () => {
    mocks.sync.mockRejectedValue({ code: "42501", message: "permission denied for table example" });
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "permission denied for table example" });
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ status: "error", sync_error: "permission denied for table example" }));
    expect(chain.eq).toHaveBeenLastCalledWith("organization_id", "org");
    expect(instagramSyncErrorMessage(null)).toBe("Falha na sincronização");
    expect(instagramSyncErrorMessage(new Error("Conexão expirada"))).toBe("Conexão expirada");
  });
});
