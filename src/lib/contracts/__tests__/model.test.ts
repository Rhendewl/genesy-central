import { describe, it, expect } from "vitest";
import { templateFields, renderContract } from "../model";
import { contentHash, signerToken } from "../server";
describe("contract snapshots", () => {
  it("finds distinct placeholders and inserts values without interpreting them as HTML or replacements", () => {
    expect(
      templateFields("{{cliente_nome}} {{ cliente_nome }} {{valor}}"),
    ).toEqual(["cliente_nome", "valor"]);
    expect(
      renderContract("{{cliente_nome}} · {{valor}} · {{cliente_endereco}}", {
        cliente_nome: "Ana $&",
        valor: "R$ 300",
      }),
    ).toBe("Ana $& · R$ 300 · ");
  });
  it("rejects missing required fields before issuing", () => {
    expect(() =>
      renderContract("{{cliente_nome}} {{valor}}", { cliente_nome: "Ana" }),
    ).toThrow("valor");
  });
  it("binds unique bearer links to signer IDs and fingerprints document edits", () => {
    const previous = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-secret";
    try {
      expect(signerToken("a")).toHaveLength(64);
      expect(signerToken("a")).not.toBe(signerToken("b"));
      expect(contentHash("Contrato")).not.toBe(
        contentHash("Contrato alterado"),
      );
    } finally {
      if (previous === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = previous;
    }
  });
});
