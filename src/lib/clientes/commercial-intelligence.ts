import type { FormStep } from "@/types";
import type { CommercialDevelopment, CommercialDiagnosis, CommercialResponse } from "@/types/commercial-intelligence";

export const DEFAULT_CAMPAIGN_PARSER = "\\[([^\\]]+)\\]";
const LEAD_GENERATION_OBJECTIVES = new Set(["leads", "conversoes", "vendas"]);

const QUESTION_WEIGHTS = { ignore: 0, low: 1, medium: 2, high: 3, critical: 5 } as const;

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

export function filterLeadGenerationDevelopments(
  developments: CommercialDevelopment[],
  objectivesByCampaignId: Map<string, string>,
): CommercialDevelopment[] {
  return developments.filter((development) => development.leads > 0 || development.campaignIds.some((id) => LEAD_GENERATION_OBJECTIVES.has(objectivesByCampaignId.get(id) ?? "")));
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

export function calculateCommercialScore(questions: FormStep[], answers: Record<string, unknown>): number | null {
  let weightedScore = 0;
  let totalWeight = 0;
  for (const question of questions) {
    const weight = QUESTION_WEIGHTS[question.weight ?? "medium"];
    if (!weight) continue;
    const answer = answers[question.id];
    let score: number | null = null;
    if (question.type === "rating") {
      const value = Number(answer);
      if (Number.isFinite(value)) score = value / (question.maxRating ?? 5) * 10;
    } else if (question.type === "single_choice") {
      const selected = question.choices?.find((choice) => choice.value === answer);
      if (selected?.score) score = selected.score * 2;
    }
    if (score === null) continue;
    weightedScore += Math.max(0, Math.min(10, score)) * weight;
    totalWeight += weight;
  }
  return totalWeight ? Number((weightedScore / totalWeight).toFixed(2)) : null;
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
  const performance = developments.map((development) => {
    const rows = responses.filter((response) => response.development_name === development.name && response.score !== null);
    const score = rows.length ? rows.reduce((sum, row) => sum + Number(row.score), 0) / rows.length : 0;
    return {
      ...development,
      score,
      responses: rows.length,
      cpl: development.leads > 0 ? development.spend / development.leads : null,
      ctr: development.impressions > 0 ? development.clicks / development.impressions * 100 : null,
    };
  }).sort((a, b) => b.score - a.score || b.leads - a.leads);
  const best = performance[0];
  const weakest = performance.filter((item) => item.responses > 0).sort((a, b) => a.score - b.score)[0];
  const efficient = performance.filter((item) => item.cpl !== null).sort((a, b) => Number(a.cpl) - Number(b.cpl))[0];
  const totalLeads = developments.reduce((sum, item) => sum + item.leads, 0);
  const totalSpend = developments.reduce((sum, item) => sum + item.spend, 0);
  const overallCpl = totalLeads > 0 ? totalSpend / totalLeads : null;
  const coverage = developments.length ? performance.filter((item) => item.responses > 0).length / developments.length * 100 : 0;
  const objectionCounts = new Map<string, number>();
  responses.forEach((response) => { if (response.objection) objectionCounts.set(response.objection, (objectionCounts.get(response.objection) ?? 0) + 1); });
  const objections = Array.from(objectionCounts.entries()).sort((a, b) => b[1] - a[1]);
  const objection = objections[0];
  const confidence = responses.length >= 10 && coverage >= 70 ? "boa" : responses.length >= 5 ? "moderada" : "baixa";
  const fmtMoney = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
  const fmt = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

  return {
    generatedAt: new Date().toISOString(),
    executiveSummary: responses.length
      ? `A operação registrou ${totalLeads} leads em ${developments.length} empreendimento${developments.length === 1 ? "" : "s"}, com investimento de ${fmtMoney(totalSpend)}${overallCpl !== null ? ` e CPL consolidado de ${fmtMoney(overallCpl)}` : ""}. A percepção comercial foi ${fmt(average)}/10 em ${responses.length} resposta${responses.length === 1 ? "" : "s"}; a confiança desta leitura é ${confidence}, com cobertura de ${fmt(coverage)}% dos empreendimentos.`
      : `Foram registrados ${totalLeads} leads e ${fmtMoney(totalSpend)} em mídia, mas ainda não há respostas comerciais. Sem a validação dos corretores, não é seguro otimizar orçamento apenas por CPL.`,
    highlights: [
      best?.score ? `${best.name} lidera a aderência comercial: nota ${fmt(best.score)}/10, ${best.responses} resposta${best.responses === 1 ? "" : "s"}, ${best.leads} leads${best.cpl !== null ? ` e CPL de ${fmtMoney(best.cpl)}` : ""}.` : null,
      efficient && efficient.cpl !== null ? `${efficient.name} tem o menor CPL (${fmtMoney(efficient.cpl)}) entre as campanhas com leads; a decisão de escala deve considerar também sua nota comercial de ${fmt(efficient.score)}/10.` : null,
      totalLeads > 0 && responses.length > 0 ? `Há ${(totalLeads / responses.length).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} leads de mídia para cada resposta recebida; ampliar a adesão melhora a precisão da otimização.` : null,
    ].filter((item): item is string => Boolean(item)),
    risks: [
      objection ? `A objeção “${objection[0]}” apareceu ${objection[1]} vez${objection[1] === 1 ? "" : "es"}; ela deve ser tratada como hipótese prioritária de perda no funil.` : "As objeções ainda não foram registradas de forma consistente, reduzindo a capacidade de corrigir oferta e comunicação.",
      weakest && best && weakest.name !== best.name && best.score - weakest.score >= 1.5 ? `${weakest.name} está ${fmt(best.score - weakest.score)} pontos abaixo do líder (${fmt(weakest.score)}/10). Evite ampliar verba antes de investigar público, oferta e abordagem comercial.` : null,
      confidence === "baixa" ? `Amostra insuficiente: ${responses.length} resposta${responses.length === 1 ? "" : "s"} e ${fmt(coverage)}% de cobertura. As conclusões devem orientar testes, não cortes definitivos.` : null,
    ].filter((item): item is string => Boolean(item)),
    recommendations: [
      objection ? `Prioridade 1 · Objeção: transforme “${objection[0]}” em um teste de mensagem. Crie uma variação de anúncio, uma resposta-padrão para os corretores e meça, na próxima coleta, queda na recorrência e avanço da nota.` : "Prioridade 1 · Dados comerciais: torne o registro de objeção obrigatório e peça exemplos literais antes de alterar criativos ou segmentação.",
      best?.score && best.leads > 0 ? `Prioridade 2 · Escala controlada: teste aumento gradual de verba em ${best.name} somente se o CPL (${best.cpl !== null ? fmtMoney(best.cpl) : "ainda sem leitura"}) estiver dentro da meta. Preserve um grupo de controle e compare qualidade, visitas e vendas.` : "Prioridade 2 · Validação: mantenha o orçamento estável até alcançar ao menos 5 respostas e cobertura comercial de 70% dos empreendimentos.",
      weakest && weakest.score > 0 ? `Prioridade 3 · Recuperação: em ${weakest.name}, revise promessa do anúncio versus produto, segmentação e velocidade do primeiro contato. Meta da próxima rodada: elevar a nota de ${fmt(weakest.score)} para pelo menos ${fmt(Math.min(10, weakest.score + 1.5))}.` : "Prioridade 3 · Instrumentação: acompanhe semanalmente CPL, CTR, tempo de resposta, qualificação, visitas e vendas por empreendimento.",
      `Regra de decisão: escalar apenas quando houver eficiência de mídia e aderência comercial ao mesmo tempo; CPL baixo com nota inferior a 7 indica volume barato, não necessariamente oportunidade de venda.`,
    ],
  };
}
