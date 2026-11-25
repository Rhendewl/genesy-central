// Período de análise dos módulos Financeiro e Clientes:
// "Este mês", "7 dias", "15 dias" ou um intervalo personalizado (mês inteiro ou dias escolhidos no calendário).

export type PeriodPreset = "mes" | "7d" | "15d" | "custom";

export interface FinancialPeriod {
  preset: PeriodPreset;
  /** Primeiro dia incluído (yyyy-MM-dd). */
  start: string;
  /** Último dia incluído (yyyy-MM-dd). */
  end: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const isoDay = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const parseDay = (value: string) => new Date(`${value}T12:00:00`);
const addDays = (value: string, days: number) => { const date = parseDay(value); date.setDate(date.getDate() + days); return isoDay(date); };
const monthEnd = (year: number, month: number) => isoDay(new Date(year, month, 0));
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** Mês inteiro (do dia 1 ao último dia). */
export function monthPeriod(year: number, month: number, today = new Date()): FinancialPeriod {
  const current = year === today.getFullYear() && month === today.getMonth() + 1;
  return { preset: current ? "mes" : "custom", start: `${year}-${pad(month)}-01`, end: monthEnd(year, month) };
}

export function presetPeriod(preset: Exclude<PeriodPreset, "custom">, today = new Date()): FinancialPeriod {
  if (preset === "mes") return monthPeriod(today.getFullYear(), today.getMonth() + 1, today);
  const end = isoDay(today);
  return { preset, start: addDays(end, preset === "7d" ? -6 : -14), end };
}

export function customPeriod(start: string, end: string, today = new Date()): FinancialPeriod {
  const [first, last] = start <= end ? [start, end] : [end, start];
  const period: FinancialPeriod = { preset: "custom", start: first, end: last };
  // Um mês inteiro escolhido no calendário é tratado como "mês" (e vira "Este mês" se for o atual).
  if (isFullMonth(period)) return monthPeriod(Number(first.slice(0, 4)), Number(first.slice(5, 7)), today);
  return period;
}

export function isFullMonth({ start, end }: Pick<FinancialPeriod, "start" | "end">) {
  return start.endsWith("-01") && start.slice(0, 7) === end.slice(0, 7) && end === monthEnd(Number(start.slice(0, 4)), Number(start.slice(5, 7)));
}

export function periodDays({ start, end }: Pick<FinancialPeriod, "start" | "end">) {
  return Math.round((parseDay(end).getTime() - parseDay(start).getTime()) / 86_400_000) + 1;
}

/** Período anterior de mesma duração (para mês inteiro, o mês anterior inteiro). */
export function previousPeriod(period: FinancialPeriod): { start: string; end: string } {
  if (isFullMonth(period)) {
    const year = Number(period.start.slice(0, 4)), month = Number(period.start.slice(5, 7));
    const prev = new Date(year, month - 2, 1);
    return { start: isoDay(prev), end: monthEnd(prev.getFullYear(), prev.getMonth() + 1) };
  }
  const days = periodDays(period);
  return { start: addDays(period.start, -days), end: addDays(period.start, -1) };
}

/** Mês de referência para o que é mensal por natureza (metas, NPS, saúde): o mês do último dia do período. */
export function periodMonth(period: FinancialPeriod) {
  return { year: Number(period.end.slice(0, 4)), month: Number(period.end.slice(5, 7)) };
}

export function periodLabel(period: FinancialPeriod) {
  if (period.preset === "7d") return "Últimos 7 dias";
  if (period.preset === "15d") return "Últimos 15 dias";
  if (isFullMonth(period)) return `${MONTHS[Number(period.start.slice(5, 7)) - 1]} ${period.start.slice(0, 4)}`;
  // "10 – 18 nov 2026", "28 out – 05 nov 2026", "20 dez 2026 – 05 jan 2027"
  const [ys, ms, ds] = period.start.split("-"), [ye, me, de] = period.end.split("-");
  const mes = (m: string) => MONTHS[Number(m) - 1].slice(0, 3).toLowerCase();
  if (ys !== ye) return `${ds} ${mes(ms)} ${ys} – ${de} ${mes(me)} ${ye}`;
  if (ms !== me) return `${ds} ${mes(ms)} – ${de} ${mes(me)} ${ye}`;
  return `${ds} – ${de} ${mes(me)} ${ye}`;
}

/** Como o período anterior é chamado nos textos ("mês anterior" ou "período anterior"). */
export function previousLabel(period: FinancialPeriod) {
  return isFullMonth(period) ? "mês anterior" : "período anterior";
}

/** Fração de um mês que o período representa (1 para um mês inteiro). Usada para mensalidades e comissões. */
export function monthFraction(period: Pick<FinancialPeriod, "start" | "end">) {
  return isFullMonth(period) ? 1 : periodDays(period) / 30;
}
