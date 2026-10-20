import { describe, it, expect } from "vitest";
import { bscSummary, objectiveInMonth, type BscMetric } from "../bsc";
const metric = (id: string, value: number): BscMetric => ({
  id: `${id}-${value}`,
  objective_id: id,
  title: "Receita",
  unit: "R$",
  baseline: 0,
  target: 100,
  current_value: value,
});
describe("BSC achievement", () => {
  it("filters objective dates without splitting cumulative metrics by month", () => {
    const o = { start_date: "2026-09-10", due_date: "2026-11-20" };
    expect(objectiveInMonth(o, "2026-08")).toBe(false);
    expect(objectiveInMonth(o, "2026-09")).toBe(true);
    expect(objectiveInMonth(o, "2026-10")).toBe(true);
    expect(objectiveInMonth(o, "2026-11")).toBe(true);
    expect(objectiveInMonth(o, "2026-12")).toBe(false);
    expect(objectiveInMonth({}, "2026-10")).toBe(true);
    expect(objectiveInMonth(o, "")).toBe(true);
  });
  it("averages indicators, then objectives, then perspectives with equal weights", () => {
    const s = bscSummary(
      [
        { id: "a", perspective: "financeira", status: "em_andamento" },
        { id: "b", perspective: "financeira", status: "planejado" },
        { id: "c", perspective: "clientes", status: "concluido" },
      ],
      [metric("a", 100), metric("a", 0), metric("b", 100), metric("c", 0)],
    );
    expect(s.scores.get("a")).toBe(50);
    expect(s.perspectives[0].score).toBe(75);
    expect(s.overall).toBe(37.5);
  });
  it("does not pretend an unmeasured objective has zero achievement", () => {
    const s = bscSummary(
      [{ id: "a", perspective: "financeira", status: "planejado" }],
      [],
    );
    expect(s.overall).toBeNull();
    expect(s.perspectives[0].measured).toBe(0);
  });
  it("excludes cancelled and unclassified objectives from BSC aggregates", () => {
    expect(
      bscSummary(
        [
          { id: "a", perspective: "financeira", status: "cancelado" },
          { id: "b", status: "em_andamento" },
        ],
        [metric("a", 100), metric("b", 100)],
      ).overall,
    ).toBeNull();
  });
  it("handles reduction targets and caps outperformance at 100 to avoid compensating misses", () => {
    const s = bscSummary(
      [{ id: "a", perspective: "processos", status: "em_andamento" }],
      [{ ...metric("a", 5), baseline: 10, target: 0 }, metric("a", 200)],
    );
    expect(s.overall).toBe(75);
  });
});
