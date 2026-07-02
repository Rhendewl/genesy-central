// ── CalendarService ───────────────────────────────────────────────────────────
// Single responsibility: Calendar aggregate CRUD.
// Does NOT handle availability rules, exceptions, or slots — those are
// delegated to AvailabilityService.
//
// Follows the same pattern as LeadService:
//   1. Validate domain rules (name, slug, timezone, numeric bounds)
//   2. Delegate atomic write to CalendarRepository
//   3. Publish domain events fire-and-forget after successful commit

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventBus }          from "@/lib/event-bus/types";
import type { DomainEventType }   from "@/lib/event-bus/domain-events";
import { getPlatformEventBus }    from "@/lib/event-bus/platform";
import { CalendarRepository }     from "./repositories/calendar-repository";
import {
  validateNewCalendar,
  validateUpdateCalendar,
  firstError,
} from "./validators";
import type {
  AppointmentCalendar,
  NewAppointmentCalendar,
  UpdateAppointmentCalendar,
} from "@/types/appointments";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

// ── Exported so AvailabilityService can re-use the same result shape ─────────
export type ServiceErrorCode = "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "SERVER_ERROR";

export interface ServiceResult<T = void> {
  ok:        boolean;
  data:      T | null;
  error:     string | null;
  errorCode?: ServiceErrorCode;
}

// ── Slug utilities ────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")  // strip combining diacritics (replaces the broad range)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "calendario";    // fallback if name has only special chars
}

// ── CalendarService ───────────────────────────────────────────────────────────

export class CalendarService {
  private readonly calendars: CalendarRepository;
  private readonly bus:       EventBus<DomainEventType>;

  constructor(db: Db, bus?: EventBus<DomainEventType>) {
    this.calendars = new CalendarRepository(db);
    this.bus       = bus ?? getPlatformEventBus();
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  async listCalendars(userId: string): Promise<ServiceResult<AppointmentCalendar[]>> {
    try {
      const data = await this.calendars.listByUser(userId);
      return { ok: true, data, error: null };
    } catch (err) {
      return { ok: false, data: null, error: err instanceof Error ? err.message : "Erro" };
    }
  }

  async getCalendar(id: string, userId: string): Promise<ServiceResult<AppointmentCalendar>> {
    try {
      const data = await this.calendars.findById(id, userId);
      if (!data) return { ok: false, data: null, error: "Calendário não encontrado" };
      return { ok: true, data, error: null };
    } catch (err) {
      return { ok: false, data: null, error: err instanceof Error ? err.message : "Erro" };
    }
  }

  // ── Write ─────────────────────────────────────────────────────────────────

  async createCalendar(
    userId:  string,
    payload: NewAppointmentCalendar,
  ): Promise<ServiceResult<AppointmentCalendar>> {
    // 1. Validate field constraints
    const validation = validateNewCalendar(payload);
    if (!validation.ok) {
      return { ok: false, data: null, error: firstError(validation), errorCode: "VALIDATION" };
    }

    try {
      // 2. Auto-generate slug if absent
      const slug = payload.slug?.trim() || slugify(payload.name.trim());

      // 3. Check slug uniqueness
      const exists = await this.calendars.slugExists(userId, slug);
      if (exists) {
        return { ok: false, data: null, error: "Já existe um calendário ativo com este slug", errorCode: "CONFLICT" };
      }

      // 4. Persist
      const data = await this.calendars.create(userId, { ...payload, slug });

      // 5. Publish — fire-and-forget, same as LeadService pattern
      this.bus.publish("calendar.created", {
        calendarId: data.id,
        userId,
        name:       data.name,
        slug:       data.slug,
      });

      return { ok: true, data, error: null };
    } catch (err) {
      return { ok: false, data: null, error: err instanceof Error ? err.message : "Erro" };
    }
  }

  async updateCalendar(
    id:      string,
    userId:  string,
    payload: UpdateAppointmentCalendar,
  ): Promise<ServiceResult<AppointmentCalendar>> {
    const validation = validateUpdateCalendar(payload);
    if (!validation.ok) {
      return { ok: false, data: null, error: firstError(validation), errorCode: "VALIDATION" };
    }

    try {
      if (payload.slug) {
        const slug   = payload.slug.trim();
        const exists = await this.calendars.slugExists(userId, slug, id);
        if (exists) {
          return { ok: false, data: null, error: "Já existe um calendário ativo com este slug", errorCode: "CONFLICT" };
        }
        payload = { ...payload, slug };
      }

      const data = await this.calendars.update(id, userId, payload);

      this.bus.publish("calendar.updated", {
        calendarId: id,
        userId,
        changes:    payload as Record<string, unknown>,
      });

      return { ok: true, data, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      if (msg === "NOT_FOUND") return { ok: false, data: null, error: "Calendário não encontrado", errorCode: "NOT_FOUND" };
      return { ok: false, data: null, error: msg, errorCode: "SERVER_ERROR" };
    }
  }

  async archiveCalendar(id: string, userId: string): Promise<ServiceResult> {
    try {
      // Verify ownership before archiving
      const calendar = await this.calendars.findById(id, userId);
      if (!calendar) return { ok: false, data: null, error: "Calendário não encontrado", errorCode: "NOT_FOUND" };

      await this.calendars.archive(id, userId);

      this.bus.publish("calendar.archived", { calendarId: id, userId });

      return { ok: true, data: null, error: null };
    } catch (err) {
      return { ok: false, data: null, error: err instanceof Error ? err.message : "Erro" };
    }
  }
}
