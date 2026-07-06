// ── BookingCrmSyncService ──────────────────────────────────────────────────────
// Syncs a new booking to the Genesy CRM.
//
// DESIGN CONTRACT:
//   • Never throws — failure is recorded in history but never blocks booking.
//   • Deduplicates leads by email OR phone before creating.
//   • Reuses LeadService directly — zero logic duplication.

import type { SupabaseClient } from "@supabase/supabase-js";
import { LeadService }         from "@/lib/crm/lead-service";
import type { AppointmentCrmSettings } from "@/types/appointments";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export interface CrmSyncPayload {
  bookingId:    string;
  calendarId:   string;
  calendarName: string;
  userId:       string;
  crmSettings:  AppointmentCrmSettings | null | undefined;
  visitorName:  string;
  visitorEmail: string;
  visitorPhone: string | null;
  visitorNotes: string | null;
  startsAt:     string;
  attribution:  Record<string, unknown>;
  correlationId: string | null;
}

export class BookingCrmSyncService {
  constructor(private readonly db: Db) {}

  async syncBooking(payload: CrmSyncPayload): Promise<void> {
    try {
      await this._doSync(payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[CrmSync] Failed for booking ${payload.bookingId}:`, msg);
      void this.db.from("appointment_booking_history").insert({
        booking_id: payload.bookingId,
        user_id:    payload.userId,
        event_type: "crm_failed",
        actor:      "system",
        actor_id:   null,
        payload:    { error: msg },
      }).then();
    }
  }

  private async _doSync(payload: CrmSyncPayload): Promise<void> {
    const cfg = payload.crmSettings;
    if (!cfg?.enabled || !cfg.stage_id) return;

    // 1. Deduplicate: find existing lead by email OR phone
    const filters: string[] = [];
    if (payload.visitorEmail) filters.push(`email.eq.${payload.visitorEmail}`);
    if (payload.visitorPhone) filters.push(`contact.eq.${payload.visitorPhone}`);

    let existingLeadId: string | null = null;

    if (filters.length > 0) {
      const { data } = await this.db
        .from("leads")
        .select("id")
        .eq("user_id", payload.userId)
        .or(filters.join(","))
        .limit(1)
        .maybeSingle();
      existingLeadId = data?.id ?? null;
    }

    const svc = new LeadService(this.db);

    if (existingLeadId) {
      // 2a. Lead exists → move to configured stage
      const moveResult = await svc.moveLead(
        existingLeadId,
        cfg.stage_id,
        { note: `Agendamento via calendário: ${payload.calendarName} em ${new Date(payload.startsAt).toLocaleString("pt-BR")}` },
      );

      if (!moveResult.ok) {
        throw new Error(`moveLead failed: ${moveResult.error}`);
      }

      // Link booking → lead
      await this.db
        .from("appointment_bookings")
        .update({ lead_id: existingLeadId })
        .eq("id", payload.bookingId)
        .eq("user_id", payload.userId);

      void this.db.from("appointment_booking_history").insert({
        booking_id: payload.bookingId,
        user_id:    payload.userId,
        event_type: "crm_updated",
        actor:      "system",
        actor_id:   null,
        payload:    { lead_id: existingLeadId, stage_id: cfg.stage_id },
      }).then();
    } else {
      // 2b. New lead → create in configured pipeline/stage
      const notes = [
        `Calendário: ${payload.calendarName}`,
        `Data/Hora: ${new Date(payload.startsAt).toLocaleString("pt-BR")}`,
        payload.visitorNotes ? `Observações: ${payload.visitorNotes}` : null,
        payload.correlationId ? `Correlation ID: ${payload.correlationId}` : null,
      ].filter(Boolean).join("\n");

      const createResult = await svc.createLead({
        user_id:  payload.userId,
        stageId:  cfg.stage_id,
        name:     payload.visitorName,
        contact:  payload.visitorPhone ?? payload.visitorEmail,
        email:    payload.visitorEmail,
        source:   "Agenda",
        notes:    notes || null,
        entered_at: new Date(payload.startsAt).toISOString().split("T")[0],
      });

      if (!createResult.ok || !createResult.leadId) {
        throw new Error(`createLead failed: ${createResult.error}`);
      }

      // Link booking → lead
      await this.db
        .from("appointment_bookings")
        .update({ lead_id: createResult.leadId })
        .eq("id", payload.bookingId)
        .eq("user_id", payload.userId);

      void this.db.from("appointment_booking_history").insert({
        booking_id: payload.bookingId,
        user_id:    payload.userId,
        event_type: "crm_created",
        actor:      "system",
        actor_id:   null,
        payload:    { lead_id: createResult.leadId, stage_id: cfg.stage_id },
      }).then();
    }
  }
}
