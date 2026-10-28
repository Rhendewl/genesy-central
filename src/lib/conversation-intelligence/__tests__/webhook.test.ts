// @vitest-environment node
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createHmac } from "crypto";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), admin: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => ({
  createAdminSupabaseClient: mocks.admin,
}));
vi.mock("@/lib/crypto", () => ({
  encryptToken: (text: string) => `encrypted:${text}`,
}));
import {
  GET,
  POST,
} from "@/app/api/crm/conversation-intelligence/webhook/route";
const url = "https://example.com/api/crm/conversation-intelligence/webhook";
const payload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "waba",
      changes: [
        {
          field: "messages",
          value: {
            metadata: { phone_number_id: "phone" },
            messages: [
              {
                id: "message",
                from: "5585999999999",
                timestamp: "1793100000",
                type: "text",
                text: { body: "Autorizado" },
              },
            ],
          },
        },
      ],
    },
  ],
};
function req(raw: string, valid = true) {
  return new NextRequest(url, {
    method: "POST",
    body: raw,
    headers: {
      "x-hub-signature-256": valid
        ? "sha256=" + createHmac("sha256", "secret").update(raw).digest("hex")
        : "sha256=invalid",
    },
  });
}
beforeEach(() => {
  vi.stubEnv("META_APP_SECRET", "secret");
  vi.stubEnv("WHATSAPP_CONTACT_HASH_KEY", "a".repeat(32));
  mocks.admin.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ error: null, data: true });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("Webhook handler", () => {
  it("refuses unsigned data before database access", async () => {
    expect((await POST(req(JSON.stringify(payload), false))).status).toBe(401);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("returns 503 when persistence fails so Meta can retry", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "db unavailable" } });
    expect((await POST(req(JSON.stringify(payload)))).status).toBe(503);
  });
  it("never passes a raw phone number or body to persistence", async () => {
    expect((await POST(req(JSON.stringify(payload)))).status).toBe(200);
    const args = mocks.rpc.mock.calls[0][1];
    expect(args.p_contact).not.toBe("5585999999999");
    expect(args.p_body).toBe("encrypted:Autorizado");
    expect(args.p_waba).toBe("waba");
  });
  it("acknowledges unconsented events without retention", async () => {
    mocks.rpc.mockResolvedValue({ error: null, data: false });
    expect((await POST(req(JSON.stringify(payload)))).status).toBe(200);
  });
  it("rejects malformed JSON and oversized actual content", async () => {
    expect((await POST(req("{"))).status).toBe(400);
    expect((await POST(req("a".repeat(1048577)))).status).toBe(413);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("validates the subscription challenge and fails closed when unconfigured", async () => {
    expect(
      (
        await GET(
          new NextRequest(
            url + "?hub.mode=subscribe&hub.verify_token=x&hub.challenge=123",
          ),
        )
      ).status,
    ).toBe(403);
    vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "x");
    const r = await GET(
      new NextRequest(
        url + "?hub.mode=subscribe&hub.verify_token=x&hub.challenge=123",
      ),
    );
    expect(await r.text()).toBe("123");
  });
});
