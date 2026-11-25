import { describe, expect, it } from "vitest";
import { dataValida, hojeFortaleza, intervaloDoMes, lerValor, totais } from "../financeiro";

describe("financeiro pelo conector", () => {
  it("lê valores em reais", () => {
    expect(lerValor(2500)).toBe(2500);
    expect(lerValor(99.9)).toBe(99.9);
    expect(lerValor("1500.50")).toBe(1500.5);
    expect(lerValor("1.234,56")).toBe(1234.56);
    expect(lerValor("1.500")).toBe(1500);
    expect(lerValor("89,90")).toBe(89.9);
  });
  it("recusa valores errados", () => {
    for (const v of [0, -10, 1.005, "abc", "12,345", null, 20_000_000, Number.NaN]) expect(() => lerValor(v)).toThrow();
  });
  it("datas e meses", () => {
    expect(dataValida("2026-11-25")).toBe(true);
    expect(dataValida("2026-02-30")).toBe(false);
    expect(dataValida("25/11/2026")).toBe(false);
    expect(intervaloDoMes("2026-02")).toEqual({ inicio: "2026-02-01", fim: "2026-02-28" });
    expect(intervaloDoMes("2028-02").fim).toBe("2028-02-29");
    expect(() => intervaloDoMes("2026-13")).toThrow();
  });
  it("hoje no fuso de João Pessoa", () => {
    expect(hojeFortaleza(new Date("2026-11-26T02:30:00Z"))).toBe("2026-11-25");
    expect(hojeFortaleza(new Date("2026-11-26T03:30:00Z"))).toBe("2026-11-26");
  });
  it("totais do mês", () => {
    const r = totais(
      [{ amount: 2500, status: "pago" }, { amount: "1000.10", status: "pendente" }, { amount: 300, status: "atrasado" }, { amount: 50, status: "cancelado" }],
      [{ amount: 89.9 }, { amount: 1200 }],
    );
    expect(r.totais).toEqual({ recebido: 2500, a_receber: 1300.1, despesas: 1289.9, resultado: 1210.1 });
  });
});
