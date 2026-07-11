"use client";

import { AgendaDayCell } from "./AgendaDayCell";
import { type EventsByDay } from "./constants";
import { format } from "date-fns";
import type { NormalizedCalendarEvent } from "@/types/google-calendar";

const WEEKDAY_LABELS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

interface AgendaDesktopGridProps {
  days:         Date[];
  eventsByDay:  EventsByDay;
  onDayClick:   (day: Date) => void;
  onEventClick: (event: NormalizedCalendarEvent) => void;
  /** Altura mínima de cada linha (px). Sem isso, a linha só cresce até o
   * espaço disponível no card — em cards largos e curtos (ex: página
   * dedicada do Workspace, sem altura fixa) as células ficam achatadas. */
  minRowHeight?: number;
}

// Colunas e linhas em `1fr` — a grade estica para preencher 100% do espaço
// interno do card (largura e altura), em vez de células de tamanho fixo
// centralizadas. Não são mais quadrados perfeitos de propósito: o objetivo é
// simetria e preenchimento total, respeitando as margens do card.
const columnsStyle = { gridTemplateColumns: "repeat(7, minmax(0, 1fr))" };

export function AgendaDesktopGrid({ days, eventsByDay, onDayClick, onEventClick, minRowHeight = 0 }: AgendaDesktopGridProps) {
  return (
    <div className="hidden h-full min-h-0 flex-col px-3 py-2 md:flex">
      <div className="mb-2 grid flex-shrink-0 gap-2" style={columnsStyle}>
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="text-center text-[9px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            {label}
          </span>
        ))}
      </div>
      <div
        className="grid min-h-0 flex-1 gap-2"
        style={{ ...columnsStyle, gridTemplateRows: `repeat(4, minmax(${minRowHeight}px, 1fr))` }}
      >
        {days.map((day) => (
          <AgendaDayCell
            key={format(day, "yyyy-MM-dd")}
            day={day}
            events={eventsByDay.get(format(day, "yyyy-MM-dd")) ?? []}
            onDayClick={onDayClick}
            onEventClick={onEventClick}
          />
        ))}
      </div>
    </div>
  );
}
