import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { sendCommercialEmail } from "../send-commercial-email";
import { getResendClient } from "@/lib/resend";
vi.mock("@/lib/resend", () => ({ getResendClient: vi.fn(), buildCommercialAnalysisEmail: () => "<p>Análise</p>" }));
const send = vi.fn();
const update = vi.fn();
const db = { from: () => ({ update: (payload: unknown) => { update(payload); return { eq: async () => ({ error: null }) }; } }) };
const input = { delivery: { id: "delivery", broker_id: "broker", recipient_email: " TEST@EXAMPLE.COM ", attempts: 0 }, collectionId: "collection", collectionName: "Semana 1", clientName: "Cliente", analysisLink: "https://go.example.com/analise/cliente" };
describe("commercial email delivery", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("RESEND_FROM_EMAIL", "Genesy <analise@example.com>"); vi.mocked(getResendClient).mockReturnValue({ emails: { send } } as never); });
  afterEach(() => vi.unstubAllEnvs());
  it("records acceptance only when the provider returns an email id", async () => {
    send.mockResolvedValue({ data: { id: "provider-id" }, error: null });
    expect(await sendCommercialEmail(db as never, input)).toEqual({ accepted: true });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "sent", attempts: 1, last_error: null }));
    expect(send.mock.calls[0][0]).toMatchObject({ to: "test@example.com", text: expect.stringContaining(input.analysisLink) });
  });
  it("records provider rejection and permits the next recipient to be processed", async () => {
    send.mockResolvedValue({ error: { message: "Recipient blocked" } });
    expect(await sendCommercialEmail(db as never, input)).toEqual({ accepted: false });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", last_error: "Recipient blocked" }));
    send.mockResolvedValue({ data: { id: "next-id" } });
    expect(await sendCommercialEmail(db as never, input)).toEqual({ accepted: true });
  });
  it("records network exceptions and missing confirmation as failed", async () => {
    send.mockRejectedValue(new Error("Connection interrupted"));
    expect((await sendCommercialEmail(db as never, input)).accepted).toBe(false);
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ status: "failed", last_error: "Connection interrupted" }));
    send.mockResolvedValue({ data: null, error: null });
    expect((await sendCommercialEmail(db as never, input)).accepted).toBe(false);
  });
  it("keeps retries idempotent and changes the key after correcting an address", async () => {
    send.mockResolvedValue({ data: { id: "provider-id" } });
    await sendCommercialEmail(db as never, input);
    await sendCommercialEmail(db as never, input);
    await sendCommercialEmail(db as never, { ...input, delivery: { ...input.delivery, recipient_email: "correct@example.com" } });
    expect(send.mock.calls[0][1]).toEqual(send.mock.calls[1][1]);
    expect(send.mock.calls[2][1]).not.toEqual(send.mock.calls[1][1]);
  });
  it("does not send with the sandbox sender", async () => {
    vi.stubEnv("RESEND_FROM_EMAIL", "onboarding@resend.dev");
    expect((await sendCommercialEmail(db as never, input)).accepted).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});
