// ─────────────────────────────────────────────────────────────────────────────
// CRM — Leitura rápida da aba Comercial
//
// Função pura: o resultado de analyzeOperation (+ conversão do período) vira
// poucos cards diretos — o número que importa, o que ele significa e o que
// fazer. Ordem: o que é urgente primeiro, depois gargalos, equipe e resultado.
// ─────────────────────────────────────────────────────────────────────────────

import { durationLabel, type LeadTiming } from "./operation-analytics";

export interface CommercialInsight {
  readonly id:     string;
  readonly tone:   "good" | "attention" | "critical" | "info";
  readonly value:  string;      // o número em destaque
  readonly title:  string;
  readonly detail: string;
}

export interface CommercialInsightInput {
  readonly timings:      LeadTiming[];
  readonly slaMinutes:   number;
  readonly withinSla:    number | null;            // % atendidos dentro da meta
  readonly firstContact: { count: number; median: number | null; p90: number | null };
  readonly waiting:      number;
  readonly overdue:      number;
  readonly oldestWaitingMs: number | null;
  readonly slowest?:     { name: string; ms: number; current: number } | null;
  readonly team:         Array<{ name: string; medianMs: number | null; measured: number; waiting: number }>;
  readonly arrivals:     { night: number; day: number; nightMedianMs: number | null; dayMedianMs: number | null };
  readonly conversion:   { leads: number; meetings: number; sales: number; revenue: number; hasStageMetrics: boolean };
  readonly staleDays?:   number;
  readonly now?:         number;
  readonly formatMoney?: (value: number) => string;
}

const fmtPct = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: value < 10 ? 1 : 0 })}%`;
const plural = (n: number, one: string, many: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? one : many}`;

export function buildCommercialInsights(input: CommercialInsightInput): CommercialInsight[] {
  const out: CommercialInsight[] = [];
  const total = input.timings.length;
  if (!total) return [{ id: "empty", tone: "info", value: "0", title: "Nenhum lead no período", detail: "Ajuste o período, a pipeline ou o responsável para ver a leitura da operação." }];
  const sla = durationLabel(input.slaMinutes * 60_000);

  // 1. Fila agora — o mais urgente.
  if (input.overdue > 0) {
    out.push({
      id: "queue", tone: "critical", value: plural(input.overdue, "lead", "leads"),
      title: `Esperando além da meta de ${sla}`,
      detail: `${plural(input.waiting, "lead está", "leads estão")} na etapa inicial${input.oldestWaitingMs ? `; o mais antigo espera há ${durationLabel(input.oldestWaitingMs)}` : ""}. Priorize o primeiro contato antes de novas abordagens.`,
    });
  } else if (input.waiting > 0) {
    out.push({ id: "queue", tone: "good", value: plural(input.waiting, "lead", "leads"), title: "Na fila, todos dentro da meta", detail: `Ninguém esperando mais que ${sla} pelo primeiro contato.` });
  }

  // 2. Primeiro atendimento contra a meta.
  if (input.withinSla !== null && input.firstContact.count >= 3) {
    const rate = input.withinSla;
    const tone = rate >= 80 ? "good" : rate >= 50 ? "attention" : "critical";
    out.push({
      id: "sla", tone, value: fmtPct(rate),
      title: `Atendidos dentro de ${sla}`,
      detail: `Mediana de ${durationLabel(input.firstContact.median)} até o primeiro contato; 90% em até ${durationLabel(input.firstContact.p90)} (${plural(input.firstContact.count, "atendimento medido", "atendimentos medidos")}).${rate < 50 ? " Quanto mais rápido o primeiro contato, maior a chance de conversa." : ""}`,
    });
  }

  // 3. Resultado do período.
  const c = input.conversion;
  if (c.hasStageMetrics && c.leads > 0) {
    const meetingRate = (c.meetings / c.leads) * 100;
    const saleRate = (c.sales / c.leads) * 100;
    const money = c.revenue > 0 && input.formatMoney ? ` · ${input.formatMoney(c.revenue)} em vendas` : "";
    out.push({
      id: "conversion", tone: c.sales > 0 ? "good" : c.meetings > 0 ? "info" : "attention",
      value: fmtPct(meetingRate),
      title: "Dos leads chegaram à reunião",
      detail: `${plural(c.meetings, "reunião", "reuniões")} e ${plural(c.sales, "venda", "vendas")} entre ${plural(c.leads, "lead", "leads")} (${fmtPct(saleRate)} viraram venda)${money}.`,
    });
  }

  // 4. Gargalo do funil.
  if (input.slowest && input.slowest.ms > 0) {
    out.push({
      id: "bottleneck", tone: input.slowest.ms > 3 * 86_400_000 ? "attention" : "info",
      value: durationLabel(input.slowest.ms),
      title: `Etapa mais lenta: ${input.slowest.name}`,
      detail: `É o tempo médio para sair dela${input.slowest.current ? `; ${plural(input.slowest.current, "lead está", "leads estão")} lá agora` : ""}. Defina o próximo passo e um prazo para essa etapa.`,
    });
  }

  // 5. Leads parados há muitos dias.
  const staleDays = input.staleDays ?? 7;
  const now = input.now ?? Date.now();
  const stale = input.timings.filter(t => {
    const open = t.visits.find(v => v.exitedAt === null);
    return open && now - Date.parse(open.enteredAt) > staleDays * 86_400_000;
  }).length;
  if (stale > 0 && stale / total >= 0.1) {
    out.push({ id: "stale", tone: "attention", value: plural(stale, "lead", "leads"), title: `Parados há mais de ${staleDays} dias`, detail: `${fmtPct((stale / total) * 100)} dos leads do período não mudam de etapa há mais de uma semana. Vale um follow-up ou encerrar como perdido.` });
  }

  // 6. Equipe: quem atende mais rápido e mais devagar.
  const measured = input.team.filter(t => t.medianMs !== null && t.measured >= 3 && t.name !== "Sem responsável");
  if (measured.length >= 2) {
    const sorted = [...measured].sort((a, b) => (a.medianMs ?? 0) - (b.medianMs ?? 0));
    const fast = sorted[0], slow = sorted[sorted.length - 1];
    if ((slow.medianMs ?? 0) > (fast.medianMs ?? 0) * 2) {
      out.push({ id: "team", tone: "info", value: durationLabel(fast.medianMs), title: `${fast.name} é quem atende mais rápido`, detail: `Mediana de primeiro contato: ${fast.name} ${durationLabel(fast.medianMs)}, ${slow.name} ${durationLabel(slow.medianMs)}. Compare a rotina dos dois.` });
    }
  }
  const unassigned = input.timings.filter(t => !t.lead.assigned_to).length;
  if (unassigned > 0 && unassigned / total >= 0.15) {
    out.push({ id: "unassigned", tone: "attention", value: plural(unassigned, "lead", "leads"), title: "Sem responsável", detail: `${fmtPct((unassigned / total) * 100)} dos leads do período não têm dono. Defina um responsável padrão na pipeline ou use uma roleta.` });
  }

  // 7. Horário de chegada.
  const arrivals = input.arrivals.night + input.arrivals.day;
  if (arrivals >= 10) {
    const nightShare = (input.arrivals.night / arrivals) * 100;
    const { nightMedianMs: n, dayMedianMs: d } = input.arrivals;
    if (n !== null && d !== null && n > d * 2 && n - d > 30 * 60_000) {
      out.push({ id: "night", tone: "attention", value: fmtPct(nightShare), title: "Chegam à noite e esperam mais", detail: `Leads da noite (18h–6h) levam ${durationLabel(n)} até o primeiro contato, contra ${durationLabel(d)} dos que chegam de dia. Uma mensagem automática ou um plantão à noite ajuda.` });
    } else if (nightShare >= 40) {
      out.push({ id: "night", tone: "info", value: fmtPct(nightShare), title: "Dos leads chegam à noite", detail: "Boa parte da demanda chega fora do horário comercial (18h–6h). Garanta resposta rápida também nesse período." });
    }
  }

  // Urgente primeiro; o resultado do período (conversão) sempre aparece logo depois.
  const order: Record<CommercialInsight["tone"], number> = { critical: 0, attention: 2, good: 3, info: 4 };
  const weight = (item: CommercialInsight) => (item.id === "conversion" ? 1 : order[item.tone]);
  return out.sort((a, b) => weight(a) - weight(b)).slice(0, 6);
}
