import { describe, expect, it } from "vitest";
import type { FormStep } from "@/types";
import { detectSubmissionSpam } from "../submission-spam";

const steps = [
  { id: "name", type: "name", title: "Nome" },
  { id: "phone", type: "phone", title: "Telefone" },
  { id: "interest", type: "multiple_choice", title: "Interesse" },
] as FormStep[];

describe("submission spam detection", () => {
  it("detecta o honeypot preenchido", () => {
    expect(detectSubmissionSpam({ steps, answers: {}, website: "https://spam.test" }))
      .toBe("honeypot");
  });

  it("bloqueia a assinatura sintética recorrente com ou sem acento", () => {
    expect(detectSubmissionSpam({
      steps,
      answers: { name: "João Silva", phone: "(83) 98765-4321", interest: "moradia" },
    })).toBe("known_synthetic_contact");

    expect(detectSubmissionSpam({
      steps,
      answers: { name: "Joao Silva", phone: "(11) 98765-4321", interest: "investimento" },
    })).toBe("known_synthetic_contact");
  });

  it("não bloqueia homônimo com telefone real nem o telefone isolado", () => {
    expect(detectSubmissionSpam({
      steps,
      answers: { name: "João Silva", phone: "(83) 99123-4567", interest: "moradia" },
    })).toBeNull();

    expect(detectSubmissionSpam({
      steps,
      answers: { name: "Maria Souza", phone: "(83) 98765-4321", interest: "moradia" },
    })).toBeNull();
  });
});
