"use client";

import { useMemo } from "react";
import { format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AgendaEventBar } from "./AgendaEventBar";
import type { EventsByDay } from "./constants";
import type { NormalizedCalendarEvent } from "@/types/google-calendar";

const MAX_EVENTS_PER_DAY = 2;

interface AgendaMobileCompactGridProps {
  days:         Date[];
  eventsByDay:  EventsByDay;
  onDayClick:   (day: Date) => void;
  onEventClick: (event: NormalizedCalendarEvent) => void;
}

export function AgendaMobileCompactGrid({ days, eventsByDay, onDayClick, onEventClick }: AgendaMobileCompactGridProps) {
  const visibleDays = useMemo(() => {
    const todayIndex = days.findIndex((day) => isToday(day));
    const startIndex = todayIndex >= 0 ? todayIndex : 0;
    return days.slice(startIndex, startIndex + 4);
  }, [days]);

  return (
    <div className="grid grid-cols-2 gap-2 md:hidden">
      {visibleDays.map((day) => {
        const dayKey = format(day, "yyyy-MM-dd");
        const events = eventsByDay.get(dayKey) ?? [];
        const visibleEvents = events.slice(0, MAX_EVENTS_PER_DAY);
        const overflow = events.length - visibleEvents.length;
        const today = isToday(day);

        return (
          <button
            key={dayKey}
            type="button"
            onClick={() => onDayClick(day)}
            className="flex aspect-square min-w-0 flex-col rounded-2xl p-3 text-left transition-colors"
            style={{
              background: today ? "var(--glass-bg)" : "var(--glass-bg-soft)",
              border: `1px solid ${today ? "var(--border-card-hover)" : "var(--border-card)"}`,
              boxShadow: today ? "0 0 0 1px var(--border-card-hover), 0 12px 30px var(--shadow-sm)" : undefined,
            }}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-lg font-bold leading-none tabular-nums" style={{ color: "var(--text-title)" }}>
                  {format(day, "d")}
                </p>
                <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--muted-foreground)" }}>
                  {format(day, "EEE", { locale: ptBR })}
                </p>
              </div>
              {today && (
                <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold" style={{ background: "var(--primary)", color: "#fff" }}>
                  Hoje
                </span>
              )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
              {visibleEvents.length === 0 ? (
                <span className="mt-auto text-[10px]" style={{ color: "var(--muted-foreground)", opacity: 0.6 }}>
                  Sem eventos
                </span>
              ) : (
                visibleEvents.map((event) => (
                  <AgendaEventBar key={event.id} event={event} onClick={onEventClick} />
                ))
              )}
              {overflow > 0 && (
                <span className="text-[10px] font-medium" style={{ color: "var(--muted-foreground)" }}>
                  +{overflow}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
