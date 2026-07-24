import { describe, expect, it } from "vitest";
import { formatSubmissionAnswer, getNpsPresentation, humanizeStoredValue } from "../format-answer";
import type { FormStep } from "@/types";

describe("formatSubmissionAnswer", () => {
  it("troca o valor técnico de uma escolha pelo rótulo visível", () => {
    const step: FormStep = {
      id: "goal",
      type: "single_choice",
      title: "Qual é o seu objetivo?",
      required: true,
      choices: [{ id: "choice-1", value: "sim,_é_o_que_busco", label: "Sim, é o que busco" }],
    };

    expect(formatSubmissionAnswer("sim,_é_o_que_busco", step)).toBe("Sim, é o que busco");
  });

  it("formata escala NPS de 0 a 10", () => {
    const step: FormStep = {
      id: "nps",
      type: "nps_scale",
      title: "Quanto você nos recomendaria?",
      required: true,
    };

    expect(formatSubmissionAnswer(9, step)).toBe("9 de 10");
    expect(getNpsPresentation(9)).toMatchObject({ score: 9, label: "Promotor" });
    expect(getNpsPresentation(8)).toMatchObject({ score: 8, label: "Neutro" });
    expect(getNpsPresentation(6)).toMatchObject({ score: 6, label: "Detrator" });
  });

  it("humaniza valores antigos mesmo quando a opção não existe mais", () => {
    expect(humanizeStoredValue("imediato,_quero_o_melhor_preço"))
      .toBe("imediato, quero o melhor preço");
  });

  it("preserva zero como resposta válida", () => {
    expect(formatSubmissionAnswer(0)).toBe("0");
    expect(getNpsPresentation(0)).toMatchObject({ score: 0, label: "Detrator" });
  });
});
