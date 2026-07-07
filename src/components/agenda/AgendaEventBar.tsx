"use client";

import { AGENDA_BAR_COLOR } from "./constants";
import type { NormalizedCalendarEvent } from "@/types/google-calendar";

interface AgendaEventBarProps {
  event:   NormalizedCalendarEvent;
  onClick: (event: NormalizedCalendarEvent) => void;
}

export function AgendaEventBar({ event, onClick }: AgendaEventBarProps) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(event); }}
      className="agenda-event-bar block w-full truncate rounded-md px-2 text-left text-[9px] font-medium leading-[16px] text-white/90 transition-opacity hover:opacity-80"
      style={{ background: AGENDA_BAR_COLOR }}
      title={event.title}
    >
      {event.title}
    </button>
  );
}
