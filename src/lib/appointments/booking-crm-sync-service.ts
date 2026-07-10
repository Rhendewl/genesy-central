// ── BookingCrmSyncService ──────────────────────────────────────────────────────
// Syncs a new booking to the Genesy CRM.
//
// DESIGN CONTRACT:
//   • Never throws — failure is recorded in history but never blocks booking.
//   • Deduplicates leads by email OR phone before creating.
//   • Reuses LeadService directly — zero logic duplication.

import type { SupabaseClient } from "@supabase/supabase-js";
import { format }              from "date-fns";
import { LeadService }         from "@/lib/crm/lead-service";
import type { AppointmentCrmSettings } from "@/types/appointments";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

// Linha de destaque em integration_notes — precisa ficar óbvia lendo por
// cima, sem depender do resto do texto ("Calendário:", "Data/Hora:" etc).
function meetingScheduledLine(startsAt: string): string {
  return `Reunião agendada para ${format(new Date(startsAt), "dd/MM 'às' HH:mm'h'")}`;
}

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
  /** IQ já calculado pelo bloco Calendário do formulário (LeadScoreEngine),
   *  quando o agendamento aconteceu dentro de um formulário com pergunta
   *  ponderada. `null` = agendamento fora de um formulário, ou formulário
   *  sem pergunta ponderada — não há o que propagar. */
  iqScore:      number | null;
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

      // Backfill de IQ: só se o lead existente ainda não tiver um (nunca
      // sobrescreve um IQ já calculado — "nunca muda depois de calculado").
      // Também anexa os dados deste agendamento em integration_notes (nunca
      // em "notes" — reservado para observações manuais do CRM).
      const { data: existingLead } = await this.db
        .from("leads")
        .select("iq_score, integration_notes")
        .eq("id", existingLeadId)
        .maybeSingle();

      const bookingEntry = [
        meetingScheduledLine(payload.startsAt),
        `Calendário: ${payload.calendarName}`,
        payload.visitorNotes ? `Observações: ${payload.visitorNotes}` : null,
      ].filter(Boolean).join("\n");

      const nextIntegrationNotes = existingLead?.integration_notes
        ? `${existingLead.integration_notes}\n\n${bookingEntry}`
        : bookingEntry;

      await this.db
        .from("leads")
        .update({
          integration_notes: nextIntegrationNotes,
          ...(payload.iqScore !== null && existingLead?.iq_score === null ? { iq_score: payload.iqScore } : {}),
        })
        .eq("id", existingLeadId);

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
      // 2b. New lead → create in configured pipeline/stage.
      // Dados do agendamento vão em integration_notes, nunca em "notes"
      // (reservado para observações manuais do CRM).
      const integrationNotes = [
        meetingScheduledLine(payload.startsAt),
        `Calendário: ${payload.calendarName}`,
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
        integration_notes: integrationNotes || null,
        entered_at: new Date(payload.startsAt).toISOString().split("T")[0],
        iq_score: payload.iqScore,
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
