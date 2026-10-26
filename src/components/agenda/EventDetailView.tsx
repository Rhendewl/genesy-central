"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, MapPin, Users, ExternalLink, Bell } from "lucide-react";
import type { NormalizedCalendarEvent } from "@/types/google-calendar";

interface EventDetailViewProps {
  event: NormalizedCalendarEvent;
}

const RESPONSE_LABEL: Record<string, string> = {
  accepted:     "Confirmado",
  declined:     "Recusado",
  tentative:    "Talvez",
  needsAction:  "Aguardando resposta",
};

export function EventDetailView({ event }: EventDetailViewProps) {
  const timeLabel = event.isAllDay
    ? "Dia inteiro"
    : `${format(parseISO(event.start), "HH:mm")} – ${format(parseISO(event.end), "HH:mm")}`;

  return (
    <div className="flex flex-col gap-5 px-5 py-5">
      <div>
        <p className="text-base font-semibold" style={{ color: "var(--text-title)" }}>
          {event.title}
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
          {format(parseISO(event.start), "EEEE, d 'de' MMMM", { locale: ptBR })}
        </p>
      </div>

      <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-title)" }}>
        <Clock size={15} style={{ color: "var(--muted-foreground)" }} />
        {timeLabel}
      </div>

      {event.location && (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-title)" }}>
          <MapPin size={15} style={{ color: "var(--muted-foreground)" }} />
          {event.location}
        </div>
      )}

      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
          Descrição
        </p>
        <p className="whitespace-pre-wrap text-sm" style={{ color: "var(--text-title)" }}>
          {event.description || "Sem descrição"}
        </p>
      </div>

      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
          <Users size={12} />
          Participantes
        </p>
        {event.attendees.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-title)" }}>Sem participantes</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {event.attendees.map((a) => (
              <li key={a.email} className="flex items-center justify-between text-sm">
                <span style={{ color: "var(--text-title)" }}>{a.name || a.email}</span>
                {a.responseStatus && (
                  <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                    {RESPONSE_LABEL[a.responseStatus] ?? a.responseStatus}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {event.reminders && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]"><Bell size={12} /> Lembretes</p>
          {event.reminders.useDefault ? <p className="text-sm">Padrão do Google Agenda</p> : (event.reminders.overrides?.length ?? 0) === 0 ? <p className="text-sm">Sem lembretes</p> : (
            <ul className="flex flex-col gap-1 text-sm">
              {event.reminders.overrides?.map((reminder, index) => {
                const minutes = reminder.minutes;
                const interval = minutes === 0 ? "No horário do evento" : minutes % 1440 === 0 ? `${minutes / 1440} dia(s) antes` : minutes % 60 === 0 ? `${minutes / 60} hora(s) antes` : `${minutes} minuto(s) antes`;
                return <li key={index}>{reminder.method === "email" ? "E-mail" : "Notificação"}: {interval}</li>;
              })}
            </ul>
          )}
        </div>
      )}

      <a
        href={event.htmlLink}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs font-medium"
        style={{ color: "var(--primary)" }}
      >
        Abrir no Google Calendar
        <ExternalLink size={12} />
      </a>
    </div>
  );
}
