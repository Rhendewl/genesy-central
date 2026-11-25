import { describe, expect, it } from "vitest";
import { ipPrivado, urlPublicaSegura } from "../seguranca";

describe("links aceitos por salvar_criativo", () => {
  it("aceita https público", () => {
    expect(urlPublicaSegura("https://export-download.canva.com/abc/arte.png?x=1").hostname).toBe("export-download.canva.com");
  });
  it("recusa http, localhost e IPs internos", () => {
    for (const u of ["http://exemplo.com/a.png", "https://localhost/a.png", "https://127.0.0.1/a.png", "https://10.0.0.5/a.png",
      "https://192.168.1.2/a.png", "https://169.254.169.254/latest", "https://[::1]/a.png", "https://kong.internal/a", "nada"]) {
      expect(() => urlPublicaSegura(u)).toThrow();
    }
  });
  it("classifica IPs", () => {
    expect(ipPrivado("172.16.0.1")).toBe(true);
    expect(ipPrivado("::ffff:10.1.2.3")).toBe(true);
    expect(ipPrivado("100.64.0.1")).toBe(true);
    expect(ipPrivado("187.53.96.40")).toBe(false);
    expect(ipPrivado("8.8.8.8")).toBe(false);
  });
});
