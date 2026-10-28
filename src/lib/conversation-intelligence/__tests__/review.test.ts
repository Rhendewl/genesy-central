// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ context: vi.fn(), graph: vi.fn() }));
vi.mock("@/lib/conversation-intelligence/server", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("@/lib/conversation-intelligence/server")
    >();
  return { ...original, context: mocks.context, graph: mocks.graph };
});
import { CIError } from "@/lib/conversation-intelligence/server";
import {
  GET,
  POST,
} from "@/app/api/crm/conversation-intelligence/review/route";
const url = "https://example.com/api/crm/conversation-intelligence/review";
const token = "temporary-test-token-for-review-1234567890";
const recipient = "5585999991234";
const debug = {
  data: {
    is_valid: true,
    app_id: "app",
    scopes: ["whatsapp_business_management", "whatsapp_business_messaging"],
  },
};
const phone = {
  id: "123",
  display_phone_number: "+1 555-139-7991",
  verified_name: "Test Number",
};
const req = (body: unknown) =>
  new NextRequest(url, {
    method: "POST",
    headers: {
      Origin: "https://example.com",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("WHATSAPP_REVIEW_WABA_ID", "456");
  vi.stubEnv("WHATSAPP_REVIEW_PHONE_NUMBER_ID", "123");
  vi.stubEnv("WHATSAPP_REVIEW_RECIPIENT", recipient);
  vi.stubEnv("META_APP_ID", "app");
  vi.stubEnv("META_APP_SECRET", "app-secret");
  mocks.context.mockResolvedValue({
    user: { id: "owner" },
    tenant: "owner",
    role: "admin",
  });
});
afterEach(() => vi.unstubAllEnvs());
describe("Owner-only Meta review console", () => {
  it("is disabled unless the fixed server-side test configuration exists", async () => {
    vi.stubEnv("WHATSAPP_REVIEW_RECIPIENT", "");
    const response = await GET(new NextRequest(url));
    expect(await response.json()).toEqual({
      configured: false,
      recipientLabel: null,
    });
    expect((await POST(req({ action: "send", token }))).status).toBe(503);
    expect(mocks.graph).not.toHaveBeenCalled();
  });
  it("never discloses the full recipient in configuration", async () => {
    const response = await GET(new NextRequest(url));
    const body = await response.text();
    expect(body).toContain("1234");
    expect(body).not.toContain(recipient);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("rejects an unauthenticated request before Graph access", async () => {
    mocks.context.mockRejectedValue(new CIError("Não autenticado", 401));
    expect((await POST(req({ action: "send", token }))).status).toBe(401);
    expect(mocks.graph).not.toHaveBeenCalled();
  });
  it.each([
    { user: { id: "sdr" }, tenant: "owner", role: "comercial" },
    { user: { id: "member-admin" }, tenant: "owner", role: "admin" },
    { user: { id: "owner" }, tenant: "owner", role: "gestor_comercial" },
  ])("rejects a non-owner or non-admin actor", async (actor) => {
    mocks.context.mockResolvedValue(actor);
    expect((await POST(req({ action: "send", token }))).status).toBe(403);
    expect(mocks.graph).not.toHaveBeenCalled();
  });
  it("rejects attempts to change recipient, sender, account, template or content in the browser", async () => {
    for (const key of [
      "to",
      "recipient",
      "phoneId",
      "wabaId",
      "template",
      "text",
    ]) {
      expect(
        (
          await POST(
            req({ action: "send", token, [key]: "attacker-controlled" }),
          )
        ).status,
      ).toBe(400);
    }
    expect(mocks.graph).not.toHaveBeenCalled();
  });
  it("rejects a token issued to another application", async () => {
    mocks.graph.mockResolvedValueOnce({
      data: { ...debug.data, app_id: "other-app" },
    });
    expect((await POST(req({ action: "send", token }))).status).toBe(403);
    expect(mocks.graph).toHaveBeenCalledTimes(1);
  });
  it("rejects missing WhatsApp permissions", async () => {
    mocks.graph.mockResolvedValueOnce({
      data: { ...debug.data, scopes: ["whatsapp_business_messaging"] },
    });
    expect((await POST(req({ action: "send", token }))).status).toBe(403);
    expect(mocks.graph).toHaveBeenCalledTimes(1);
  });
  it("proves access to the configured sender, not just a valid token", async () => {
    mocks.graph
      .mockResolvedValueOnce(debug)
      .mockResolvedValueOnce({ data: [{ ...phone, id: "other-phone" }] });
    expect((await POST(req({ action: "send", token }))).status).toBe(403);
    expect(mocks.graph).toHaveBeenCalledTimes(2);
  });
  it.each([
    { ...phone, verified_name: "Real SDR" },
    { ...phone, display_phone_number: "+55 85 99999-9999" },
  ])("refuses a production sender", async (sender) => {
    mocks.graph
      .mockResolvedValueOnce(debug)
      .mockResolvedValueOnce({ data: [sender] });
    expect((await POST(req({ action: "send", token }))).status).toBe(409);
    expect(mocks.graph).toHaveBeenCalledTimes(2);
  });
  it("can inspect the authorized test account without sending a message", async () => {
    mocks.graph
      .mockResolvedValueOnce(debug)
      .mockResolvedValueOnce({ data: [phone] });
    const response = await POST(req({ action: "inspect", token }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      accountId: "456",
      phone: { id: "123", name: "Test Number" },
    });
    expect(mocks.graph).toHaveBeenCalledTimes(2);
  });
  it("sends only hello_world to the fixed verified recipient when explicitly requested", async () => {
    mocks.graph
      .mockResolvedValueOnce(debug)
      .mockResolvedValueOnce({ data: [phone] })
      .mockResolvedValueOnce({ messages: [{ id: "wamid.test-accepted" }] });
    const response = await POST(req({ action: "send", token }));
    expect(response.status).toBe(200);
    expect(mocks.graph.mock.calls[2][0]).toBe("123/messages");
    expect(JSON.parse(mocks.graph.mock.calls[2][2].body)).toEqual({
      messaging_product: "whatsapp",
      to: recipient,
      type: "template",
      template: { name: "hello_world", language: { code: "en_US" } },
    });
    const body = await response.text();
    expect(body).toContain("wamid.test-accepted");
    expect(body).not.toContain(token);
    expect(body).not.toContain(recipient);
    expect(body).not.toContain("delivered");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("does not claim success if Meta did not return a message ID", async () => {
    mocks.graph
      .mockResolvedValueOnce(debug)
      .mockResolvedValueOnce({ data: [phone] })
      .mockResolvedValueOnce({ messages: [] });
    expect((await POST(req({ action: "send", token }))).status).toBe(502);
  });
  it("rejects empty or oversized requests before touching Meta", async () => {
    expect(
      await POST(req({ action: "send", token: " ".repeat(25) })),
    ).toHaveProperty("status", 400);
    expect(
      await POST(req({ action: "send", token: "x".repeat(11000) })),
    ).toHaveProperty("status", 413);
    expect(mocks.graph).not.toHaveBeenCalled();
  });
});
