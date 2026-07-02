// ── Appointments Validators ───────────────────────────────────────────────────
// Pure validation functions — no side effects, no DB access.
// Used by CalendarService, AvailabilityService, and API route handlers.

import type {
  NewAppointmentCalendar,
  UpdateAppointmentCalendar,
  NewAppointmentAvailabilityRule,
  NewAppointmentAvailabilityException,
} from "@/types/appointments";

// ── Result types ──────────────────────────────────────────────────────────────

export interface FieldError {
  field:   string;
  message: string;
}

export interface ValidationResult {
  ok:     boolean;
  errors: FieldError[];
}

function ok():                            ValidationResult { return { ok: true,  errors: [] }; }
function fail(errors: FieldError[]):      ValidationResult { return { ok: false, errors }; }
function err(f: string, m: string): FieldError          { return { field: f, message: m }; }

// ── Primitives ────────────────────────────────────────────────────────────────

export function isValidTimezone(tz: string): boolean {
  // Intl constructor throws a RangeError for unknown timezone identifiers.
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// "HH:MM" — 24-hour, strict
const TIME_RE = /^\d{2}:\d{2}$/;
export function isValidTime(t: string): boolean {
  if (!TIME_RE.test(t)) return false;
  const [h, m] = t.split(":").map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

// "YYYY-MM-DD" — rejects non-existent dates like Feb 30
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function isValidDate(d: string): boolean {
  if (!DATE_RE.test(d)) return false;
  const [y, m, day] = d.split("-").map(Number);
  const date = new Date(y, m - 1, day);
  return (
    date.getFullYear() === y &&
    date.getMonth()    === m - 1 &&
    date.getDate()     === day
  );
}

// URL-safe slug: lowercase alphanumeric and hyphens, must start/end with alnum
const SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
export function isValidSlug(s: string): boolean {
  return SLUG_RE.test(s);
}

// ── Calendar payload ──────────────────────────────────────────────────────────

export function validateNewCalendar(
  payload: Partial<NewAppointmentCalendar>,
): ValidationResult {
  const errors: FieldError[] = [];

  // name
  const name = payload.name?.trim() ?? "";
  if (!name) {
    errors.push(err("name", "Nome é obrigatório"));
  } else if (name.length > 100) {
    errors.push(err("name", "Nome deve ter no máximo 100 caracteres"));
  }

  // slug (optional at creation — CalendarService auto-generates it)
  if (payload.slug?.trim()) {
    const slug = payload.slug.trim();
    if (!isValidSlug(slug)) {
      errors.push(err("slug", "Slug deve conter apenas letras minúsculas, números e hífens"));
    } else if (slug.length > 60) {
      errors.push(err("slug", "Slug deve ter no máximo 60 caracteres"));
    }
  }

  // timezone
  if (payload.timezone && !isValidTimezone(payload.timezone)) {
    errors.push(err("timezone", "Fuso horário inválido"));
  }

  // duration_minutes
  const dur = payload.duration_minutes;
  if (dur !== undefined) {
    if (!Number.isInteger(dur) || dur <= 0) {
      errors.push(err("duration_minutes", "Duração deve ser um número inteiro positivo"));
    } else if (dur > 480) {
      errors.push(err("duration_minutes", "Duração máxima é 480 minutos (8 horas)"));
    }
  }

  // booking_window_days
  const bwd = payload.booking_window_days;
  if (bwd !== undefined) {
    if (!Number.isInteger(bwd) || bwd <= 0) {
      errors.push(err("booking_window_days", "Janela de agendamento deve ser um inteiro positivo"));
    } else if (bwd > 365) {
      errors.push(err("booking_window_days", "Janela máxima é 365 dias"));
    }
  }

  // min_notice_hours
  const mnh = payload.min_notice_hours;
  if (mnh !== undefined && (!Number.isInteger(mnh) || mnh < 0)) {
    errors.push(err("min_notice_hours", "Aviso mínimo deve ser 0 ou maior"));
  }

  // buffer_before_minutes
  const bbm = payload.buffer_before_minutes;
  if (bbm !== undefined && (!Number.isInteger(bbm) || bbm < 0)) {
    errors.push(err("buffer_before_minutes", "Buffer antes deve ser 0 ou maior"));
  }

  // buffer_after_minutes
  const bam = payload.buffer_after_minutes;
  if (bam !== undefined && (!Number.isInteger(bam) || bam < 0)) {
    errors.push(err("buffer_after_minutes", "Buffer após deve ser 0 ou maior"));
  }

  // daily_limit (optional; null = no limit)
  const dl = payload.daily_limit;
  if (dl !== undefined && dl !== null) {
    if (!Number.isInteger(dl) || dl <= 0) {
      errors.push(err("daily_limit", "Limite diário deve ser um inteiro positivo"));
    }
  }

  return errors.length ? fail(errors) : ok();
}

export function validateUpdateCalendar(
  payload: Partial<UpdateAppointmentCalendar>,
): ValidationResult {
  // Re-use the same rules but skip the "required" check on name
  // since it's a partial update — only validate fields that are present.
  const errors: FieldError[] = [];

  if (payload.name !== undefined) {
    const name = payload.name?.trim() ?? "";
    if (!name) errors.push(err("name", "Nome não pode ser vazio"));
    else if (name.length > 100) errors.push(err("name", "Nome deve ter no máximo 100 caracteres"));
  }

  if (payload.slug !== undefined && payload.slug !== null) {
    const slug = payload.slug.trim();
    if (!isValidSlug(slug)) {
      errors.push(err("slug", "Slug deve conter apenas letras minúsculas, números e hífens"));
    } else if (slug.length > 60) {
      errors.push(err("slug", "Slug deve ter no máximo 60 caracteres"));
    }
  }

  if (payload.timezone && !isValidTimezone(payload.timezone)) {
    errors.push(err("timezone", "Fuso horário inválido"));
  }

  const dur = payload.duration_minutes;
  if (dur !== undefined) {
    if (!Number.isInteger(dur) || dur <= 0) {
      errors.push(err("duration_minutes", "Duração deve ser um inteiro positivo"));
    } else if (dur > 480) {
      errors.push(err("duration_minutes", "Duração máxima é 480 minutos"));
    }
  }

  const bwd = payload.booking_window_days;
  if (bwd !== undefined) {
    if (!Number.isInteger(bwd) || bwd <= 0) {
      errors.push(err("booking_window_days", "Janela de agendamento deve ser um inteiro positivo"));
    } else if (bwd > 365) {
      errors.push(err("booking_window_days", "Janela máxima é 365 dias"));
    }
  }

  const mnh = payload.min_notice_hours;
  if (mnh !== undefined && (!Number.isInteger(mnh) || mnh < 0)) {
    errors.push(err("min_notice_hours", "Aviso mínimo deve ser 0 ou maior"));
  }

  const bbm = payload.buffer_before_minutes;
  if (bbm !== undefined && (!Number.isInteger(bbm) || bbm < 0)) {
    errors.push(err("buffer_before_minutes", "Buffer antes deve ser 0 ou maior"));
  }

  const bam = payload.buffer_after_minutes;
  if (bam !== undefined && (!Number.isInteger(bam) || bam < 0)) {
    errors.push(err("buffer_after_minutes", "Buffer após deve ser 0 ou maior"));
  }

  const dl = payload.daily_limit;
  if (dl !== undefined && dl !== null) {
    if (!Number.isInteger(dl) || dl <= 0) {
      errors.push(err("daily_limit", "Limite diário deve ser um inteiro positivo"));
    }
  }

  return errors.length ? fail(errors) : ok();
}

// ── Availability rules ────────────────────────────────────────────────────────

export function validateAvailabilityRule(
  rule: NewAppointmentAvailabilityRule,
  index: number,
): FieldError[] {
  const errors: FieldError[] = [];
  const prefix = `rules[${index}]`;

  const dow = rule.day_of_week;
  if (!Number.isInteger(dow) || dow < 0 || dow > 6) {
    errors.push(err(`${prefix}.day_of_week`, "Deve ser entre 0 (Domingo) e 6 (Sábado)"));
  }

  if (rule.is_available) {
    const st = (rule.start_time ?? "").slice(0, 5);
    const et = (rule.end_time   ?? "").slice(0, 5);

    if (!isValidTime(st)) {
      errors.push(err(`${prefix}.start_time`, "Horário de início inválido (HH:MM)"));
    }
    if (!isValidTime(et)) {
      errors.push(err(`${prefix}.end_time`, "Horário de fim inválido (HH:MM)"));
    }
    if (isValidTime(st) && isValidTime(et) && st >= et) {
      errors.push(err(`${prefix}.end_time`, "Horário de fim deve ser posterior ao início"));
    }
  }

  return errors;
}

export function validateAvailabilityRules(
  rules: NewAppointmentAvailabilityRule[],
): ValidationResult {
  if (!Array.isArray(rules)) {
    return fail([err("rules", "Campo 'rules' deve ser um array")]);
  }

  const errors: FieldError[] = [];
  const seen = new Set<number>();

  rules.forEach((rule, i) => {
    if (seen.has(rule.day_of_week)) {
      errors.push(err(`rules[${i}].day_of_week`, `Dia ${rule.day_of_week} duplicado`));
    }
    seen.add(rule.day_of_week);
    errors.push(...validateAvailabilityRule(rule, i));
  });

  return errors.length ? fail(errors) : ok();
}

// ── Availability exception ────────────────────────────────────────────────────

export function validateAvailabilityException(
  payload: NewAppointmentAvailabilityException,
): ValidationResult {
  const errors: FieldError[] = [];

  if (!isValidDate(payload.exception_date)) {
    errors.push(err("exception_date", "Data inválida (YYYY-MM-DD)"));
  }

  if (!["blocked", "custom_hours"].includes(payload.type)) {
    errors.push(err("type", "Tipo deve ser 'blocked' ou 'custom_hours'"));
  }

  if (payload.type === "custom_hours") {
    const st = (payload.start_time ?? "").slice(0, 5);
    const et = (payload.end_time   ?? "").slice(0, 5);

    if (!isValidTime(st)) {
      errors.push(err("start_time", "Horário de início inválido (HH:MM)"));
    }
    if (!isValidTime(et)) {
      errors.push(err("end_time", "Horário de fim inválido (HH:MM)"));
    }
    if (isValidTime(st) && isValidTime(et) && st >= et) {
      errors.push(err("end_time", "Horário de fim deve ser posterior ao início"));
    }
  }

  return errors.length ? fail(errors) : ok();
}

// ── Helpers for API routes ────────────────────────────────────────────────────

export function firstError(result: ValidationResult): string {
  return result.errors[0]?.message ?? "Payload inválido";
}
