"use client";

import { format, isToday } from "date-fns";
import { AgendaEventBar } from "./AgendaEventBar";
import type { NormalizedCalendarEvent } from "@/types/google-calendar";

interface AgendaDayCellProps {
  day:          Date;
  events:       NormalizedCalendarEvent[];
  onDayClick:   (day: Date) => void;
  onEventClick: (event: NormalizedCalendarEvent) => void;
}

export function AgendaDayCell({ day, events, onDayClick, onEventClick }: AgendaDayCellProps) {
  const today = isToday(day);
  const firstEvent = events[0] ?? null;
  const overflowCount = events.length > 1 ? events.length - 1 : 0;

  return (
    <button
      type="button"
      onClick={() => onDayClick(day)}
      className="agenda-day-cell flex h-full w-full min-w-0 flex-col rounded-lg p-1.5 text-left transition-colors"
      data-today={today || undefined}
      style={{
        background:      today ? "rgba(124,135,141,0.32)" : "rgba(124,135,141,0.2)",
        border:          `1px solid ${today ? "rgba(124,135,141,0.5)" : "rgba(124,135,141,0.2)"}`,
        boxShadow:       today
          ? "0 0 0 1px var(--border-card-hover), 0 4px 20px rgba(0,0,0,0.04)"
          : undefined,
      }}
    >
      <div className="mb-1 flex flex-shrink-0 items-baseline justify-between">
        <span className="text-sm font-semibold leading-none" style={{ color: today ? "var(--text-title)" : "var(--text-body)" }}>
          {format(day, "d")}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-start gap-1 overflow-hidden">
        {firstEvent && (
          <div className="flex-shrink-0">
            <AgendaEventBar event={firstEvent} onClick={onEventClick} />
          </div>
        )}
        {overflowCount > 0 && (
          <span className="flex-shrink-0 px-2 text-[9px] font-medium text-[var(--muted-foreground)]">
            +{overflowCount}
          </span>
        )}
        {events.length === 0 && (
          <span className="block truncate whitespace-nowrap px-1 text-[8px] text-[var(--muted-foreground)] opacity-60">
            Sem eventos
          </span>
        )}
      </div>
    </button>
  );
}
