import { addDays, differenceInCalendarDays, format, getDay, parseISO, subDays } from "date-fns";
import type { CommercialFrequency } from "@/types/commercial-intelligence";

const CADENCE_DAYS: Record<CommercialFrequency, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};

export const DEFAULT_COMMERCIAL_SEND_WEEKDAYS = [1];

export function normalizeCommercialSendWeekdays(days: unknown): number[] {
  if (!Array.isArray(days)) return DEFAULT_COMMERCIAL_SEND_WEEKDAYS;
  const normalized = Array.from(new Set(days.filter((day): day is number =>
    Number.isInteger(day) && day >= 0 && day <= 6,
  ))).sort((left, right) => left - right);
  return normalized.length ? normalized : DEFAULT_COMMERCIAL_SEND_WEEKDAYS;
}

export type CommercialAutomationSlot = "A" | "B";

export function commercialAutomationWindow(today: string, frequency: CommercialFrequency) {
  const end = parseISO(today);
  return {
    start: format(subDays(end, CADENCE_DAYS[frequency] - 1), "yyyy-MM-dd"),
    end: today,
  };
}

export function commercialCollectionDue(lastPeriodEnd: string | null, today: string, frequency: CommercialFrequency) {
  if (!lastPeriodEnd) return { due: true, daysRemaining: 0 };
  const elapsed = differenceInCalendarDays(parseISO(today), parseISO(lastPeriodEnd));
  return { due: elapsed >= CADENCE_DAYS[frequency], daysRemaining: Math.max(0, CADENCE_DAYS[frequency] - elapsed) };
}

export function nextCommercialSendDate(
  lastPeriodEnd: string | null,
  today: string,
  frequency: CommercialFrequency,
  sendWeekdays: unknown,
): string {
  const weekdays = normalizeCommercialSendWeekdays(sendWeekdays);
  const cadenceStart = lastPeriodEnd
    ? addDays(parseISO(lastPeriodEnd), CADENCE_DAYS[frequency])
    : parseISO(today);
  let candidate = cadenceStart > parseISO(today) ? cadenceStart : parseISO(today);
  for (let offset = 0; offset < 14; offset++) {
    if (weekdays.includes(getDay(candidate))) return format(candidate, "yyyy-MM-dd");
    candidate = addDays(candidate, 1);
  }
  return format(candidate, "yyyy-MM-dd");
}

export function commercialCadenceDays(frequency: CommercialFrequency) {
  return CADENCE_DAYS[frequency];
}

export function nextCommercialAutomationSlot(lastSlot: CommercialAutomationSlot | null): CommercialAutomationSlot {
  return lastSlot === "A" ? "B" : "A";
}

export function inferCommercialAutomationSlot(name: string, snapshot: Record<string, unknown> | null): CommercialAutomationSlot | null {
  const stored = snapshot?.automation_template_slot;
  if (stored === "A" || stored === "B") return stored;
  const match = name.match(/semana\s+(\d)/i);
  if (!match) return null;
  return Number(match[1]) % 2 === 0 ? "B" : "A";
}

export function evaluateCommercialSample(params: {
  leads: number;
  activeDays: number;
  minimumLeads: number;
  minimumActiveDays: number;
}) {
  if (params.leads < params.minimumLeads) {
    return { eligible: false, reason: `Coleta adiada — ${params.leads} de ${params.minimumLeads} leads mínimos no período.` };
  }
  if (params.activeDays < params.minimumActiveDays) {
    return { eligible: false, reason: `Coleta adiada — ${params.activeDays} de ${params.minimumActiveDays} dias com atividade no período.` };
  }
  return { eligible: true, reason: "Amostra suficiente para gerar a coleta." };
}

export function nextCommercialCheckDate(today: string) {
  return format(addDays(parseISO(today), 1), "yyyy-MM-dd");
}
