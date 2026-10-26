import type { CalendarReminder, CreateCalendarEventInput } from "@/types/google-calendar";

export class CalendarValidationError extends Error {}

export function validateCalendarEvent(input: unknown): CreateCalendarEventInput {
  const fail = (message: string): never => { throw new CalendarValidationError(message); };
  if (!input || typeof input !== "object" || Array.isArray(input)) return fail("Evento inválido.");
  const data = input as Record<string, unknown>;
  const text = (key: string, max: number, required = false) => {
    const value = data[key] ?? "";
    if (typeof value !== "string" || value.length > max) return fail(`Campo ${key} inválido.`);
    if (required && !value.trim()) return fail("Informe o título do evento.");
    return value.trim();
  };
  const title = text("title", 1024, true);
  const description = text("description", 8000);
  const location = text("location", 1024);
  const timestamp = (key: string) => {
    const value = data[key];
    // Require an explicit offset so server timezone never changes the event time.
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) {
      return fail("Informe datas e horários válidos.");
    }
    const day = value.slice(0, 10);
    if (new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) return fail("Data inválida.");
    return value;
  };
  const start = timestamp("start");
  const end = timestamp("end");
  if (Date.parse(end) <= Date.parse(start)) return fail("O término deve ser posterior ao início.");
  if (typeof data.timezone !== "string" || data.timezone.length > 100) return fail("Fuso horário inválido.");
  try { new Intl.DateTimeFormat("pt-BR", { timeZone: data.timezone }); }
  catch { return fail("Fuso horário inválido."); }
  if (!Array.isArray(data.reminders) || data.reminders.length > 5) return fail("Configure no máximo 5 lembretes.");
  const reminders = data.reminders.map((item: unknown): CalendarReminder => {
    if (!item || typeof item !== "object") return fail("Lembrete inválido.");
    const reminder = item as Record<string, unknown>;
    if (reminder.method !== "popup" && reminder.method !== "email") return fail("Tipo de lembrete inválido.");
    if (typeof reminder.minutes !== "number" || !Number.isInteger(reminder.minutes) || reminder.minutes < 0 || reminder.minutes > 40320) {
      return fail("Os lembretes devem estar entre 0 minutos e 28 dias antes do evento.");
    }
    return { method: reminder.method, minutes: reminder.minutes };
  });
  const unique = reminders.filter((r, i) => reminders.findIndex((v) => v.method === r.method && v.minutes === r.minutes) === i);
  return { title, description, location, start, end, timezone: data.timezone, reminders: unique };
}
