import { describe, expect, it } from "vitest";
import { colunasDoAgente, duracao, indicadores } from "../board";
import type { EsteiraItem } from "@/types/esteira";

const base = (over: Partial<EsteiraItem>): EsteiraItem => ({
  id: Math.random().toString(36), agente: "alfred", ref: "r", cliente: null, titulo: "t", detalhe: null,
  etapa: "pedido", etapa_desde: "2026-11-25T12:00:00Z", progresso: null, passo_atual: null, links: [],
  decisao: null, decisao_nota: null, decidido_em: null, decisao_entregue_em: null,
  created_at: "2026-11-25T11:00:00Z", updated_at: "2026-11-25T12:00:00Z", ...over,
});

describe("colunasDoAgente", () => {
  it("separa por agente, junta concluídos em No ar e esconde cancelados", () => {
    const itens = [
      base({ etapa: "no_ar" }), base({ etapa: "concluido" }), base({ etapa: "cancelado" }),
      base({ agente: "bruce", etapa: "esperando" }),
    ];
    const cols = colunasDoAgente(itens, "alfred");
    expect(cols.map((c) => c.etapa)).toEqual(["pedido", "produzindo", "esperando", "aprovado", "no_ar"]);
    expect(cols.find((c) => c.etapa === "no_ar")?.itens).toHaveLength(2);
    expect(cols.find((c) => c.etapa === "esperando")?.itens).toHaveLength(0);
  });
  it("em Esperando você, o mais antigo vem primeiro", () => {
    const cols = colunasDoAgente([
      base({ titulo: "novo", etapa: "esperando", etapa_desde: "2026-11-25T12:30:00Z" }),
      base({ titulo: "antigo", etapa: "esperando", etapa_desde: "2026-11-25T09:00:00Z" }),
    ], "alfred");
    expect(cols[2].itens.map((i) => i.titulo)).toEqual(["antigo", "novo"]);
  });
});

describe("indicadores", () => {
  it("conta esperando, produzindo, entregues hoje e o tempo médio", () => {
    const agora = Date.parse("2026-11-25T15:00:00Z");
    const k = indicadores([
      base({ etapa: "esperando" }), base({ etapa: "produzindo" }),
      base({ etapa: "no_ar", created_at: "2026-11-25T12:00:00Z", etapa_desde: "2026-11-25T13:00:00Z" }),
    ], agora);
    expect(k).toMatchObject({ esperando: 1, produzindo: 1, entreguesHoje: 1, tempoMedio: "1 h" });
  });
  it("formata durações", () => {
    expect(duracao(42 * 60_000)).toBe("42 min");
    expect(duracao(90 * 60_000)).toBe("1 h 30 min");
    expect(duracao(26 * 3_600_000)).toBe("1 d 2 h");
  });
});
