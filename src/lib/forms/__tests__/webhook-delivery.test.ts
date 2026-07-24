import { describe, expect, it } from "vitest";
import { buildWebhookAnswerViews, validateWebhookUrl } from "../webhook-delivery";
import type { FormStep } from "@/types";

describe("validateWebhookUrl", () => {
  it("aceita HTTPS público", async () => {
    await expect(validateWebhookUrl("https://1.1.1.1/webhooks/forms")).resolves.toMatchObject({
      protocol: "https:",
      pathname: "/webhooks/forms",
    });
  });

  it("rejeita HTTP", async () => {
    await expect(validateWebhookUrl("http://1.1.1.1/hook")).rejects.toThrow(/HTTPS/);
  });

  it.each([
    "https://127.0.0.1/hook",
    "https://10.0.0.2/hook",
    "https://192.168.1.10/hook",
    "https://169.254.169.254/latest/meta-data",
    "https://[::1]/hook",
  ])("rejeita destino privado %s", async url => {
    await expect(validateWebhookUrl(url)).rejects.toThrow(/privado|local/);
  });

  it("rejeita credenciais embutidas", async () => {
    await expect(validateWebhookUrl("https://user:pass@1.1.1.1/hook")).rejects.toThrow(/Credenciais/);
  });

  it("rejeita porta fora do HTTPS padrão", async () => {
    await expect(validateWebhookUrl("https://1.1.1.1:8443/hook")).rejects.toThrow(/porta/);
  });
});

describe("buildWebhookAnswerViews", () => {
  it("expõe perguntas por título e preserva os IDs e valores originais", () => {
    const steps: FormStep[] = [
      { id: "question-id-1", type: "short_text", title: "Qual é o seu nome?", required: true },
      {
        id: "question-id-2",
        type: "single_choice",
        title: "Qual cidade você prefere?",
        required: true,
        choices: [{ id: "choice-1", value: "jp", label: "João Pessoa" }],
      },
    ];

    const result = buildWebhookAnswerViews(steps, {
      "question-id-1": "Ana",
      "question-id-2": "jp",
    });

    expect(result.answersByQuestion).toEqual({
      "Qual é o seu nome?": "Ana",
      "Qual cidade você prefere?": "João Pessoa",
    });
    expect(result.fields[1]).toMatchObject({
      id: "question-id-2",
      question: "Qual cidade você prefere?",
      answer: "João Pessoa",
      value: "jp",
      raw_value: "jp",
    });
  });

  it("não sobrescreve perguntas que tenham o mesmo título", () => {
    const steps: FormStep[] = [
      { id: "one", type: "short_text", title: "Observação", required: false },
      { id: "two", type: "long_text", title: "Observação", required: false },
    ];

    expect(buildWebhookAnswerViews(steps, { one: "Primeira", two: "Segunda" }).answersByQuestion)
      .toEqual({ Observação: "Primeira", "Observação (2)": "Segunda" });
  });
});
