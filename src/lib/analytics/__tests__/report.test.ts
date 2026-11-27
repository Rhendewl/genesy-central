import { describe, expect, it } from "vitest";
import { bucketKey, buildFormReport, buildRecommendations, classifySource, classifyTraffic, decodeLabel, type ReportSession } from "../report";

const steps = [
  { id: "s1", title: "<p>Qual é o seu nome?</p>", type: "name" },
  { id: "s2", title: "Telefone", type: "phone" },
  { id: "info", title: "Aviso", type: "statement" },
  { id: "s3", title: "Renda", type: "single_choice" },
];

function session(id: string, extra: Partial<ReportSession> = {}): ReportSession {
  return {
    id, device: "mobile", browser: "Chrome", os: "Android",
    utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, referrer: null,
    started_at: "2026-11-20T13:00:00.000Z", finished_at: null, ...extra,
  };
}

describe("buildFormReport", () => {
  const report = buildFormReport({
    steps,
    granularity: "day",
    since: "2026-11-19T03:00:00.000Z",
    until: "2026-11-21T02:59:59.000Z",
    now: Date.parse("2026-11-21T00:00:00.000Z"),
    sessions: [
      session("a", { utm_source: "ig", utm_campaign: "%5BCIDADE+JARDIM%5D+-+Est%C3%A1ticos", finished_at: "2026-11-20T13:01:30.000Z" }),
      session("b", { referrer: "https://l.instagram.com/" }),
      session("c", { device: "desktop", referrer: "https://dash.genesycompany.com/formularios" }),
      session("d", { device: "desktop" }),
    ],
    submissions: [
      { session_id: "a", status: "completed", score: 80, created_at: "2026-11-20T13:01:30.000Z", answers: { s1: "Ana", s2: "83999999999", s3: "até 3k" } },
      { session_id: "b", status: "partial", score: null, created_at: "2026-11-20T13:00:40.000Z", answers: { s1: "Bia", s2: "" } },
      { session_id: "c", status: "partial", score: null, created_at: "2026-11-20T13:00:05.000Z", answers: {} },
    ],
    events: [
      { session_id: "a", event: "step_completed", step_id: "s1", duration: 6, created_at: "2026-11-20T13:00:10.000Z" },
      { session_id: "a", event: "answer_changed", step_id: "s3", duration: null, created_at: "2026-11-20T13:01:00.000Z" },
    ],
  });

  it("conta acessos, início, conclusão e respostas parciais a partir de sessões e respostas", () => {
    expect(report.summary.visits).toBe(4);
    expect(report.summary.started).toBe(2);
    expect(report.summary.completed).toBe(1);
    expect(report.summary.partialLeads).toBe(1);
    expect(report.summary.conversionRate).toBe(25);
    expect(report.summary.completionRate).toBe(50);
    expect(report.summary.bounceRate).toBe(50);
    expect(report.summary.avgCompletionSecs).toBe(90);
    expect(report.summary.avgScore).toBe(80);
  });

  it("monta o funil por pergunta ignorando blocos sem resposta e aponta onde as pessoas param", () => {
    expect(report.questions.map(q => q.stepId)).toEqual(["s1", "s2", "s3"]);
    expect(report.questions[0].title).toBe("Qual é o seu nome?");
    expect(report.questions.map(q => q.answered)).toEqual([2, 1, 1]);
    expect(report.questions[1].droppedHere).toBe(1);
    expect(report.questions[0].medianSecs).toBe(6);
    expect(report.questions[2].answerChanges).toBe(1);
    expect(report.funnel.map(f => f.value)).toEqual([4, 2, 2, 1, 1, 1]);
  });

  it("agrupa origem, campanha decodificada e dispositivos com conversão", () => {
    const instagram = report.sources.find(s => s.key === "instagram");
    expect(instagram?.visits).toBe(2);
    expect(instagram?.conversionRate).toBe(50);
    expect(report.sources.find(s => s.key === "interno")?.visits).toBe(1);
    expect(report.campaigns[0].label).toBe("[CIDADE JARDIM] - Estáticos");
    expect(report.devices.find(d => d.key === "mobile")?.visits).toBe(2);
  });

  it("preenche os dias sem acesso na linha do tempo, no horário de João Pessoa", () => {
    expect(report.timeline.map(p => p.key)).toEqual(["2026-11-19", "2026-11-20"]);
    expect(report.timeline[1].visits).toBe(4);
    expect(report.heatmap[0]).toMatchObject({ weekday: 5, hour: 10 });
  });

  it("gera recomendações somente com volume suficiente", () => {
    expect(buildRecommendations(report)[0].id).toBe("few-visits");
  });
});

describe("classificação de origem", () => {
  it("usa UTM antes do referrer e reconhece os principais canais", () => {
    expect(classifySource({ utm_source: "IG", referrer: null })).toBe("instagram");
    expect(classifySource({ utm_source: "fb", referrer: null })).toBe("facebook");
    expect(classifySource({ utm_source: null, referrer: "https://m.facebook.com/" })).toBe("facebook");
    expect(classifySource({ utm_source: null, referrer: "https://go.genesycompany.com/x" })).toBe("links");
    expect(classifySource({ utm_source: null, referrer: null })).toBe("direto");
  });

  it("separa anúncio, orgânico e direto", () => {
    expect(classifyTraffic(session("x", { utm_source: "fb", utm_campaign: "52544157728194" }))).toBe("pago");
    expect(classifyTraffic(session("x", { referrer: "https://instagram.com/" }))).toBe("organico");
    expect(classifyTraffic(session("x"))).toBe("direto");
  });

  it("decodifica rótulos e calcula semanas a partir da segunda-feira", () => {
    expect(decodeLabel("Est%C3%A1ticos+Ana")).toBe("Estáticos Ana");
    expect(bucketKey("2026-11-26T15:00:00.000Z", "week")).toBe("2026-11-23");
  });
});
