import type { FormStep } from "@/types";
import type { CommercialDevelopment, CommercialDiagnosis, CommercialResponse } from "@/types/commercial-intelligence";

export const DEFAULT_CAMPAIGN_PARSER = "\\[([^\\]]+)\\]";

export const DEFAULT_COMMERCIAL_TEMPLATES: Array<{
  name: string;
  description: string;
  week: number;
  questions: FormStep[];
}> = [
  {
    name: "Semana 1 · Qualidade dos leads",
    description: "Percepção de qualidade, intenção e principais objeções.",
    week: 1,
    questions: [
      { id: "quality_score", type: "rating", title: "Como você avalia a qualidade dos leads?", required: true, maxRating: 10 },
      { id: "lead_profile", type: "single_choice", title: "Como você classificaria a maioria dos leads?", required: true, choices: choice(["Quente", "Morno", "Frio", "Fora do perfil"]) },
      { id: "main_objection", type: "long_text", title: "Qual foi a principal objeção?", required: true },
      { id: "more_leads", type: "single_choice", title: "Você gostaria de receber mais leads deste empreendimento?", required: true, choices: choice(["Sim", "Não", "Talvez"]) },
    ],
  },
  {
    name: "Semana 2 · Atendimento",
    description: "Velocidade de contato, retorno e avanço no atendimento.",
    week: 2,
    questions: [
      { id: "response_time", type: "single_choice", title: "Em quanto tempo os leads foram atendidos?", required: true, choices: choice(["Até 5 minutos", "Até 30 minutos", "Até 2 horas", "Mais de 2 horas"]) },
      { id: "answer_rate", type: "rating", title: "Como você avalia a taxa de retorno dos leads?", required: true, maxRating: 10 },
      { id: "appointments", type: "number", title: "Quantos avançaram para visita ou reunião?", required: true },
      { id: "service_difficulty", type: "long_text", title: "Qual foi a principal dificuldade no atendimento?", required: false },
    ],
  },
  {
    name: "Semana 3 · Produto",
    description: "Aderência do produto, diferenciais e barreiras percebidas.",
    week: 3,
    questions: [
      { id: "product_interest", type: "rating", title: "Qual foi o nível de interesse pelo produto?", required: true, maxRating: 10 },
      { id: "best_feature", type: "long_text", title: "Qual diferencial mais despertou interesse?", required: true },
      { id: "product_barrier", type: "long_text", title: "Qual característica mais dificultou a venda?", required: true },
      { id: "price_perception", type: "single_choice", title: "Como o cliente percebeu o preço?", required: true, choices: choice(["Muito competitivo", "Adequado", "Alto", "Muito alto"]) },
    ],
  },
  {
    name: "Semana 4 · Mercado",
    description: "Concorrência, momento de compra e sinais do mercado.",
    week: 4,
    questions: [
      { id: "market_temperature", type: "rating", title: "Como você avalia o interesse do mercado nesta semana?", required: true, maxRating: 10 },
      { id: "competitor", type: "long_text", title: "Qual concorrente foi mais citado?", required: false },
      { id: "purchase_timing", type: "single_choice", title: "Qual o momento de compra predominante?", required: true, choices: choice(["Imediato", "Até 3 meses", "De 3 a 6 meses", "Acima de 6 meses"]) },
      { id: "market_signal", type: "long_text", title: "Que sinal do mercado merece atenção?", required: false },
    ],
  },
];

function choice(labels: string[]) {
  return labels.map((label, index) => ({ id: `choice-${index + 1}`, label, value: label }));
}

export function extractDevelopmentName(campaignName: string, pattern = DEFAULT_CAMPAIGN_PARSER, group = 1): string | null {
  try {
    const match = campaignName.match(new RegExp(pattern, "i"));
    const raw = match?.[group]?.trim();
    if (!raw || /^\d{1,2}[/-]\d{1,2}/.test(raw) || /^(lead|form|abo|cbo|meta)/i.test(raw)) return fallbackDevelopment(campaignName);
    return titleCase(raw);
  } catch {
    return fallbackDevelopment(campaignName);
  }
}

function fallbackDevelopment(name: string): string | null {
  const cleaned = name.replace(/\[[^\]]*(?:\d{1,2}[/-]\d{1,2}|lead|form|abo|cbo|meta)[^\]]*\]/gi, " ")
    .replace(/\b(lead|form|abo|cbo|meta|ads?|campanha|convers[aã]o|tr[aá]fego)\b/gi, " ")
    .split(/\s[-|–—]\s/)
    .map((part) => part.replace(/[\[\]]/g, "").trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0];
  return cleaned ? titleCase(cleaned) : null;
}

function titleCase(value: string) {
  return value.toLocaleLowerCase("pt-BR").replace(/(^|[\s&/-])[a-záàâãéêíóôõúç]/g, (letter) => letter.toLocaleUpperCase("pt-BR"));
}

export function buildCommercialDiagnosis(developments: CommercialDevelopment[], responses: CommercialResponse[]): CommercialDiagnosis {
  const scored = responses.filter((response) => typeof response.score === "number");
  const average = scored.length ? scored.reduce((sum, item) => sum + Number(item.score), 0) / scored.length : 0;
  const best = developments.map((development) => {
    const rows = responses.filter((response) => response.development_name === development.name && response.score !== null);
    return { ...development, score: rows.length ? rows.reduce((sum, row) => sum + Number(row.score), 0) / rows.length : 0 };
  }).sort((a, b) => b.score - a.score)[0];
  const objectionCounts = new Map<string, number>();
  responses.forEach((response) => { if (response.objection) objectionCounts.set(response.objection, (objectionCounts.get(response.objection) ?? 0) + 1); });
  const objection = Array.from(objectionCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];

  return {
    generatedAt: new Date().toISOString(),
    executiveSummary: responses.length
      ? `A percepção comercial média foi ${average.toFixed(1)}/10 em ${responses.length} resposta${responses.length === 1 ? "" : "s"}. ${best?.score ? `${best.name} lidera a percepção dos corretores com nota ${best.score.toFixed(1)}.` : "A amostra ainda não permite destacar um empreendimento."}`
      : "A coleta ainda não recebeu respostas suficientes para um diagnóstico comercial.",
    highlights: best?.score ? [`${best.name} apresenta a melhor percepção comercial (${best.score.toFixed(1)}/10).`] : [],
    risks: objection ? [`A objeção mais recorrente é: ${objection}.`] : [],
    recommendations: [
      objection ? `Criar comunicação e argumentos comerciais específicos para reduzir a objeção “${objection}”.` : "Estimular a equipe a registrar objeções com exemplos concretos.",
      best?.score && best.leads > 0 ? `Cruzar a boa percepção de ${best.name} com CPL e volume antes de redistribuir investimento.` : "Aguardar uma amostra maior antes de alterar a distribuição de mídia.",
      "Revisar semanalmente os relatos comerciais junto com CPL, CTR e volume de leads.",
    ],
  };
}
