import type {
  CommercialAnalysisInput,
  CommercialAnalysisMetrics,
  CommercialAnalysisSnapshot,
} from "@/types/commercial-analysis";

const pct = (part: number, total: number) => total > 0 ? (part / total) * 100 : 0;
const rounded = (value: number) => Math.round(value * 10) / 10;
const fmtPct = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export function calculateCommercialMetrics(data: CommercialAnalysisInput): CommercialAnalysisMetrics {
  return {
    contactRate: rounded(pct(data.leads_contacted, data.leads_received)),
    responseRate: rounded(pct(data.leads_responded, data.leads_contacted)),
    noResponseRate: rounded(pct(data.leads_no_response, data.leads_contacted)),
    qualificationRate: rounded(pct(data.qualified_leads, data.leads_responded)),
    schedulingRate: rounded(pct(data.meetings_scheduled, data.qualified_leads)),
    attendanceRate: rounded(pct(data.meetings_held, data.meetings_scheduled)),
    qualifiedMeetingRate: rounded(pct(data.qualified_meetings, data.meetings_held)),
    proposalRate: rounded(pct(data.proposals_sent, data.meetings_held)),
    closingRate: rounded(pct(data.sales_closed, data.meetings_held)),
    overallConversionRate: rounded(pct(data.sales_closed, data.leads_received)),
    averageTicket: data.sales_closed > 0 ? Math.round(data.revenue / data.sales_closed) : 0,
    revenuePerLead: data.leads_received > 0 ? Math.round(data.revenue / data.leads_received) : 0,
  };
}

function normalized(value: number, target: number) {
  return Math.min(1, value / target);
}

export function buildCommercialAnalysis(
  data: CommercialAnalysisInput,
  previous?: CommercialAnalysisInput | null,
): CommercialAnalysisSnapshot {
  const metrics = calculateCommercialMetrics(data);
  const previousMetrics = previous ? calculateCommercialMetrics(previous) : null;
  const score = Math.round(100 * (
    normalized(metrics.contactRate, 90) * 0.10 +
    normalized(metrics.responseRate, 60) * 0.15 +
    normalized(metrics.qualificationRate, 40) * 0.15 +
    normalized(metrics.schedulingRate, 50) * 0.15 +
    normalized(metrics.attendanceRate, 75) * 0.20 +
    normalized(metrics.closingRate, 20) * 0.25
  ));
  const status = score >= 75 ? "healthy" : score >= 50 ? "attention" : "critical";
  const insights: CommercialAnalysisSnapshot["insights"] = [];

  insights.push({
    id: "response",
    status: metrics.responseRate >= 60 ? "good" : metrics.responseRate >= 35 ? "attention" : "critical",
    title: `Resposta dos leads: ${fmtPct(metrics.responseRate)}`,
    signal: `${data.leads_responded} responderam e ${data.leads_no_response} ficaram sem resposta entre ${data.leads_contacted} abordados.`,
    diagnosis: "Velocidade do primeiro contato, canal, mensagem inicial, quantidade de tentativas e horários da abordagem.",
    action: metrics.responseRate >= 60 ? "Preserve a cadência e documente as mensagens com maior resposta." : "Revise os leads sem resposta e teste velocidade, canal e mensagem antes de aumentar o volume.",
  });

  insights.push({
    id: "qualification",
    status: metrics.qualificationRate >= 40 ? "good" : metrics.qualificationRate >= 20 ? "attention" : "critical",
    title: `Qualificação: ${fmtPct(metrics.qualificationRate)}`,
    signal: `${data.qualified_leads} dos ${data.leads_responded} leads que responderam foram qualificados.`,
    diagnosis: "Aderência entre campanha, promessa, tipologia do empreendimento e critérios comerciais usados na triagem.",
    action: metrics.qualificationRate >= 40 ? "Mantenha os públicos e argumentos que atraem o perfil desejado." : "Compare os motivos de desqualificação com campanha e oferta e ajuste o filtro de entrada.",
  });

  insights.push({
    id: "scheduling",
    status: metrics.schedulingRate >= 50 ? "good" : metrics.schedulingRate >= 30 ? "attention" : "critical",
    title: `Conversão em agendamento: ${fmtPct(metrics.schedulingRate)}`,
    signal: `${data.meetings_scheduled} reuniões foram agendadas a partir de ${data.qualified_leads} leads qualificados.`,
    diagnosis: "Clareza da chamada para reunião, disponibilidade de agenda, urgência e condução após a qualificação.",
    action: metrics.schedulingRate >= 50 ? "Continue usando a abordagem que transforma qualificação em compromisso." : "Reduza a fricção para agendar e torne explícito o benefício do próximo encontro.",
  });

  insights.push({
    id: "attendance",
    status: metrics.attendanceRate >= 75 ? "good" : metrics.attendanceRate >= 60 ? "attention" : "critical",
    title: `Comparecimento: ${fmtPct(metrics.attendanceRate)}`,
    signal: `${data.meetings_held} de ${data.meetings_scheduled} reuniões agendadas foram realizadas; ${data.no_shows} no-shows foram informados.`,
    diagnosis: "Confirmação ativa, lembretes, tempo entre agenda e reunião e valor percebido antes do encontro.",
    action: metrics.attendanceRate >= 75 ? "Mantenha a rotina de confirmação e replique o processo." : "Implemente confirmação ativa e lembretes e analise individualmente os no-shows.",
  });

  insights.push({
    id: "closing",
    status: metrics.closingRate >= 20 ? "good" : metrics.closingRate >= 10 ? "attention" : "critical",
    title: `Conversão de reunião em venda: ${fmtPct(metrics.closingRate)}`,
    signal: `${data.sales_closed} vendas resultaram de ${data.meetings_held} reuniões realizadas, com ${data.proposals_sent} propostas.`,
    diagnosis: "Qualificação prévia, diagnóstico, apresentação, oferta, preço, objeções, condição de pagamento e follow-up.",
    action: metrics.closingRate >= 20 ? "Mapeie o padrão das vendas ganhas e transforme-o em roteiro." : "Revise perdas e gravações ou relatos das reuniões antes de buscar mais agendamentos.",
  });

  if (previousMetrics) {
    const delta = rounded(metrics.overallConversionRate - previousMetrics.overallConversionRate);
    insights.push({
      id: "trend",
      status: delta > 0 ? "good" : delta < 0 ? "attention" : "info",
      title: delta > 0 ? "Conversão geral melhorou" : delta < 0 ? "Conversão geral recuou" : "Conversão geral estável",
      signal: `${delta > 0 ? "+" : ""}${fmtPct(delta)} em relação à análise anterior.`,
      diagnosis: "Mudanças de volume e das taxas de resposta, qualificação, comparecimento e fechamento entre os períodos.",
      action: delta > 0 ? "Registre o que mudou e mantenha o teste por mais um ciclo." : "Compare os dois funis e ataque primeiro a etapa com maior queda.",
    });
  }

  const weakest = [...insights].filter((item) => item.id !== "trend").sort((a, b) => {
    const weight = { critical: 0, attention: 1, info: 2, good: 3 };
    return weight[a.status] - weight[b.status];
  })[0];
  const executiveSummary = status === "healthy"
    ? `A operação comercial está saudável (${score}/100). O principal objetivo é sustentar o processo e escalar sem perder qualidade.`
    : `A operação exige ${status === "critical" ? "intervenção prioritária" : "atenção"} (${score}/100). O primeiro ponto a tratar é ${weakest?.title.toLowerCase() ?? "o maior vazamento do funil"}.`;

  return { score, status, executiveSummary, metrics, insights };
}
