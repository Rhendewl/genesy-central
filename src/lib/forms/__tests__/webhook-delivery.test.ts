import { describe, expect, it } from "vitest";
import {
  buildHumanReadableWebhookPayload,
  buildWebhookAnswerViews,
  validateWebhookUrl,
} from "../webhook-delivery";
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
    expect(result.crmAnswers).toEqual({
      resposta_01_qual_e_o_seu_nome: "Ana",
      resposta_02_qual_cidade_voce_prefere: "João Pessoa",
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

  it("transforma respostas múltiplas em texto direto para o CRM", () => {
    const steps: FormStep[] = [{
      id: "perfil",
      type: "multiple_choice",
      title: "Quais imóveis procura?",
      required: true,
      choices: [
        { id: "casa", value: "house", label: "Casa" },
        { id: "apto", value: "apartment", label: "Apartamento" },
      ],
    }];

    expect(buildWebhookAnswerViews(steps, { perfil: ["house", "apartment"] }).crmAnswers)
      .toEqual({ resposta_01_quais_imoveis_procura: "Casa, Apartamento" });
  });
});

describe("buildHumanReadableWebhookPayload", () => {
  it("coloca formulário, perguntas e respostas antes dos dados técnicos", () => {
    const payload = buildHumanReadableWebhookPayload({
      eventId: "event-1",
      eventType: "form.submission.completed",
      correlationId: "correlation-1",
      timestamp: "2026-09-01T15:31:06.294Z",
      form: { id: "form-1", name: "Live Park", slug: "live-park" },
      submission: { id: "submission-1", status: "completed" },
      session: null,
      crmAnswers: {
        resposta_01_qual_e_o_seu_nome: "Lancaster Teste",
        resposta_02_qual_imovel_procura: "Apartamento",
      },
    });

    expect(Object.entries(payload).slice(0, 4)).toEqual([
      ["tipo_evento", "nova_resposta_formulario"],
      ["formulario_nome", "Live Park"],
      ["resposta_01_qual_e_o_seu_nome", "Lancaster Teste"],
      ["resposta_02_qual_imovel_procura", "Apartamento"],
    ]);
    expect(payload).toMatchObject({
      utm_source: "",
      utm_medium: "",
      utm_campaign: "",
      utm_term: "",
      utm_content: "",
      fbclid: "",
      gclid: "",
      referrer: "",
      recebido_em: "2026-09-01T15:31:06.294Z",
    });
    expect(payload.dados_tecnicos).toMatchObject({
      id: "event-1",
      event_type: "form.submission.completed",
      version: 3,
    });
  });

  it("envia valores de exemplo para o CRM descobrir os campos de UTM no teste", () => {
    const payload = buildHumanReadableWebhookPayload({
      eventId: "test-1",
      eventType: "form.webhook.test",
      correlationId: "test-1",
      timestamp: "2026-09-01T15:31:06.294Z",
      form: { id: "form-1", name: "Live Park", slug: "live-park" },
      submission: { id: "test-submission", status: "completed" },
      session: null,
      crmAnswers: {},
      test: true,
    });

    expect(payload).toMatchObject({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "campanha_exemplo",
      utm_term: "termo_exemplo",
      utm_content: "anuncio_exemplo",
      fbclid: "fbclid_exemplo",
      gclid: "gclid_exemplo",
      referrer: "https://exemplo.com/origem",
    });
  });
});
