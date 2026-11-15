import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), notify: vi.fn(), email: "ana@example.com" }));
vi.mock("@/lib/supabase-admin", () => ({
  createAdminSupabaseClient: () => mocks,
}));
vi.mock("@/lib/contracts/notifications",()=>({notifyContractSignature:mocks.notify}));
import { GET, POST } from "@/app/api/public/assinaturas/[token]/route";
const token = "a".repeat(64);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.email = "ana@example.com";
  mocks.notify.mockResolvedValue(undefined);
  mocks.from.mockImplementation((table: string) => {
    const row =
      table === "client_contract_signers"
        ? {
            id: "signer",
            contract_id: "doc",
            name: "Ana",
            email: mocks.email,
            role: "cliente",
            signed_at: null,
          }
        : {
            id: "doc",
            title: "Contrato",
            body: "Texto",
            content_hash: "original",
            status: "pending",
            expires_at: "2099-01-01",
          };
    const q: {
      select: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
      maybeSingle: ReturnType<typeof vi.fn>;
      single: ReturnType<typeof vi.fn>;
    } = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: row }),
      single: vi.fn().mockResolvedValue({ data: row }),
    };
    q.select.mockReturnValue(q);
    q.eq.mockReturnValue(q);
    return q;
  });
});
const request = (body: unknown) =>
  new NextRequest(`https://example.com/api/public/assinaturas/${token}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
describe("public signature boundary", () => {
  it("rejects malformed links without consulting the database", async () => {
    const r = await GET(request({}), { params: { token: "invalid" } });
    expect(r.status).toBe(404);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("requires explicit consent", async () => {
    const r = await POST(
      request({
        name: "Ana",
        document: "12345678901",
        content_hash: "original",
      }),
      { params: { token } },
    );
    expect(r.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects a different document hash before recording an acceptance", async () => {
    const r = await POST(
      request({
        consent: true,
        name: "Ana",
        document: "12345678901",
        content_hash: "edited",
      }),
      { params: { token } },
    );
    expect(r.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not sign without an email code", async () => {
    const r = await POST(request({consent:true,name:"Ana",document:"12345678901",content_hash:"original"}), {params:{token}});
    expect(r.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects a failed verification before signing", async () => {
    mocks.rpc.mockResolvedValue({data:false,error:null});
    const r = await POST(request({consent:true,name:"Ana",document:"12345678901",content_hash:"original",code:"123456"}), {params:{token}});
    expect(r.status).toBe(400);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls[0][0]).toBe("verify_contract_signature_code");
  });
  it("signs a no-email invitation without inventing email verification", async () => {
    mocks.email = "";
    mocks.rpc.mockResolvedValue({data:{status:"pending"},error:null});
    const r = await POST(request({consent:true,name:"Ana",document:"12345678901",content_hash:"original"}), {params:{token}});
    expect(r.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls[0][0]).toBe("sign_client_contract");
    expect(mocks.rpc.mock.calls[0][1].p_consent).toContain("sem verificação de e-mail");
  });
  it("records the server consent text and token fingerprint, rather than client evidence", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    const r = await POST(
      request({
        consent: true,
        name: "Ana",
        document: "12345678901",
        content_hash: "original",
        p_ip: "spoofed",
        consent_text: "changed",
        code: "123456",
        style: 5,
      }),
      { params: { token } },
    );
    expect(r.status).toBe(200);
    const args = mocks.rpc.mock.calls.find(call=>call[0] === "sign_client_contract")![1];
    expect(args.p_token_hash).not.toBe(token);
    expect(args.p_ip).not.toBe("spoofed");
    expect(args.p_consent).toContain("Li integralmente");
    expect(args.p_consent).toContain("Estilo de assinatura: 5");
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.notify).toHaveBeenCalledWith(mocks,"doc","signer");
  });
  it("keeps the committed signature successful if notification persistence fails",async()=>{
    mocks.email="";mocks.rpc.mockResolvedValue({data:{status:"pending"},error:null});mocks.notify.mockRejectedValue(new Error('temporary failure'));
    const log=vi.spyOn(console,'error').mockImplementation(()=>{});
    try {
      const r=await POST(request({consent:true,name:"Ana",document:"12345678901",content_hash:"original"}),{params:{token}});
      expect(r.status).toBe(200);expect(mocks.notify).toHaveBeenCalledTimes(2);
    } finally {log.mockRestore();}
  });

});
