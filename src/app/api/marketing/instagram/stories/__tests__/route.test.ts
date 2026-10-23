// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import sharp from "sharp";
const mocks = vi.hoisted(() => ({ context: vi.fn(), from: vi.fn(), verify: vi.fn(), status: vi.fn(), publish: vi.fn(), create: vi.fn(), upload: vi.fn(), remove: vi.fn(), signed: vi.fn() }));
vi.mock("@/lib/supabase-server", () => ({ createServerSupabaseClient: async () => ({ from: mocks.from }) }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminSupabaseClient: () => ({ storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove, createSignedUrl: mocks.signed }) } }) }));
vi.mock("@/lib/marketing/server", async (original) => ({ ...await original<object>(), getMarketingServerContext: mocks.context }));
vi.mock("@/lib/crypto", () => ({ decryptToken: () => "secret", signState: () => "signed-ticket", verifyState: mocks.verify }));
vi.mock("@/lib/instagram-api", () => ({ createInstagramStory: mocks.create, getInstagramContainerStatus: mocks.status, publishInstagramStory: mocks.publish }));
import { POST } from "../route";
const request = () => new NextRequest("https://test.local", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticket: "signed" }) });
let chain: { select: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn>; single: ReturnType<typeof vi.fn> };
describe("Instagram story publishing boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.context.mockResolvedValue({ isAdmin: true, organizationId: "org", user: { id: "user" } });
    mocks.verify.mockReturnValue({ purpose: "instagram-story", organizationId: "org", userId: "user", connectionId: "account", containerId: "container", path: "asset.jpg" });
    chain = { select: vi.fn(), eq: vi.fn(), single: vi.fn() };
    chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain);
    chain.single.mockResolvedValue({ data: { instagram_user_id: "ig", requested_scopes: ["instagram_business_content_publish"], encrypted_access_token: "encrypted" } });
    mocks.from.mockReturnValue(chain); mocks.remove.mockResolvedValue({ error: null });
    mocks.upload.mockResolvedValue({ error: null }); mocks.signed.mockResolvedValue({ data: { signedUrl: "https://storage.test/story.jpg" }, error: null });
    mocks.create.mockResolvedValue({ id: "container" }); mocks.publish.mockResolvedValue({ id: "media" });
  });
  it("rejects non-admin users before accessing accounts or Meta", async () => {
    mocks.context.mockResolvedValue({ isAdmin: false }); expect((await POST(request())).status).toBe(403); expect(mocks.from).not.toHaveBeenCalled();
  });
  it("rejects tickets belonging to another organization", async () => {
    mocks.verify.mockReturnValue({ purpose: "instagram-story", organizationId: "other", userId: "user" });
    expect((await POST(request())).status).toBe(403); expect(mocks.publish).not.toHaveBeenCalled();
  });
  it("requires publication authorization and scopes account lookup to organization", async () => {
    chain.single.mockResolvedValue({ data: { requested_scopes: [] } });
    expect((await POST(request())).status).toBe(400); expect(chain.eq).toHaveBeenCalledWith("organization_id", "org"); expect(mocks.publish).not.toHaveBeenCalled();
  });
  it("waits for processing instead of publishing prematurely", async () => {
    mocks.status.mockResolvedValue({ status_code: "IN_PROGRESS" });
    expect(await (await POST(request())).json()).toEqual({ published: false, processing: true }); expect(mocks.publish).not.toHaveBeenCalled();
  });
  it("publishes the same signed container when ready", async () => {
    mocks.status.mockResolvedValue({ status_code: "FINISHED" });
    expect(await (await POST(request())).json()).toEqual({ published: true, mediaId: "media" });
    expect(mocks.publish).toHaveBeenCalledWith("ig", "secret", "container"); expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.remove).toHaveBeenCalledWith(["asset.jpg"]);
  });
  it("confirms a previously published container without publishing twice", async () => {
    mocks.status.mockResolvedValue({ status_code: "PUBLISHED" });
    expect(await (await POST(request())).json()).toEqual({ published: true }); expect(mocks.publish).not.toHaveBeenCalled();
  });
  it("keeps the asset when publication result is uncertain for a safe retry", async () => {
    mocks.status.mockResolvedValue({ status_code: "FINISHED" }); mocks.publish.mockRejectedValueOnce(new Error("timeout"));
    expect((await POST(request())).status).toBe(500); expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("uploads a valid story and prepares without publishing", async () => {
    const jpeg = await sharp({ create: { width: 1080, height: 1920, channels: 3, background: "#123456" } }).jpeg().toBuffer();
    const form = new FormData(); form.set("connectionId", "account"); form.set("image", new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" }), "story.jpg");
    const response = await POST(new NextRequest("https://test.local", { method: "POST", body: form }));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ ticket: "signed-ticket" }); expect(mocks.publish).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith("ig", "secret", "https://storage.test/story.jpg");
  });
  it("rejects forged image content before upload", async () => {
    const form = new FormData(); form.set("connectionId", "account"); form.set("image", new Blob(["not jpeg"], { type: "image/jpeg" }), "story.jpg");
    expect((await POST(new NextRequest("https://test.local", { method: "POST", body: form }))).status).toBe(500);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
