import { describe, expect, it } from "vitest";
import { normalizeFormRedirectUrl } from "@/lib/forms/redirect";

describe("normalizeFormRedirectUrl", () => {
  it("mantém URLs HTTPS válidas", () => {
    expect(normalizeFormRedirectUrl("https://genesy.com.br/obrigado"))
      .toBe("https://genesy.com.br/obrigado");
  });

  it("adiciona HTTPS quando o usuário informa apenas o domínio", () => {
    expect(normalizeFormRedirectUrl("genesy.com.br/agenda"))
      .toBe("https://genesy.com.br/agenda");
  });

  it("bloqueia protocolos executáveis", () => {
    expect(normalizeFormRedirectUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeFormRedirectUrl("data:text/html,teste")).toBeNull();
  });

  it("rejeita valor vazio ou inválido", () => {
    expect(normalizeFormRedirectUrl("")).toBeNull();
    expect(normalizeFormRedirectUrl("https://")).toBeNull();
  });
});
