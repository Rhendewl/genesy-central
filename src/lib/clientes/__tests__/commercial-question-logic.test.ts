import { describe, expect, it } from "vitest";
import type { FormStep, LogicRule } from "@/types";
import { commercialQuestionPath, nextCommercialQuestionIndex, validateCommercialLogicRules } from "../commercial-question-logic";

const questions = [
  { id: "q1", type: "single_choice", title: "Perfil", required: true, choices: [{ id: "yes", label: "Sim", value: "sim" }, { id: "no", label: "Não", value: "nao" }] },
  { id: "q2", type: "long_text", title: "Detalhes", required: true },
  { id: "q3", type: "rating", title: "Nota", required: true, maxRating: 10 },
] as FormStep[];

const rules: LogicRule[] = [{
  id: "r1",
  condition: { step: "q1", operator: "equals", value: "nao" },
  action: { type: "jump", target: "q3" },
}];

describe("commercial question logic", () => {
  it("jumps to the configured question when an answer matches", () => {
    expect(nextCommercialQuestionIndex(questions, rules, 0, { q1: "nao" })).toBe(2);
    expect(commercialQuestionPath(questions, rules, { q1: "nao", q3: 8 }).map((question) => question.id)).toEqual(["q1", "q3"]);
  });

  it("continues sequentially when no rule matches", () => {
    expect(nextCommercialQuestionIndex(questions, rules, 0, { q1: "sim" })).toBe(1);
  });

  it("rejects missing targets and cyclic rules", () => {
    expect(validateCommercialLogicRules(questions, [{ ...rules[0], action: { type: "jump", target: "missing" } }])).toContain("Toda regra precisa direcionar para uma pergunta existente.");
    expect(validateCommercialLogicRules(questions, [rules[0], { id: "r2", condition: { step: "q3", operator: "equals", value: 8 }, action: { type: "jump", target: "q1" } }])).toContain("A lógica cria um ciclo entre perguntas. Revise os direcionamentos.");
  });
});
