"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { addDays, format, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useGoogleCalendarEvents } from "@/hooks/useGoogleCalendarEvents";
import { AgendaDesktopGrid } from "./AgendaDesktopGrid";
import { AgendaMobileCarousel } from "./AgendaMobileCarousel";
import { AgendaSkeleton } from "./AgendaSkeleton";
import { AgendaDisconnectedState } from "./AgendaDisconnectedState";
import { DayDetailDrawer } from "./DayDetailDrawer";
import { groupEventsByDay } from "./constants";
import type { NormalizedCalendarEvent } from "@/types/google-calendar";

const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

const PANEL_VARIANTS = {
  enter:  (dir: number) => ({ opacity: 0, x: dir > 0 ? 24 : -24, filter: "blur(4px)" }),
  center: { opacity: 1, x: 0, filter: "blur(0px)", transition: { duration: 0.32, ease: EASE } },
  exit:   (dir: number) => ({ opacity: 0, x: dir > 0 ? -24 : 24, filter: "blur(4px)", transition: { duration: 0.22, ease: EASE } }),
};

const PANEL_VARIANTS_REDUCED = {
  enter:  { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.2 } },
  exit:   { opacity: 0, transition: { duration: 0.15 } },
};

export function AgendaSemanalPanel() {
  const shouldReduce = useReducedMotion();
  const [rangeStart, setRangeStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [direction,  setDirection]  = useState(1);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [focusEvent,  setFocusEvent]  = useState<NormalizedCalendarEvent | null>(null);

  const rangeEnd = addDays(rangeStart, 27);
  const { events, connected, isLoading, error } = useGoogleCalendarEvents(rangeStart, rangeEnd);

  const days = useMemo(
    () => Array.from({ length: 28 }, (_, i) => addDays(rangeStart, i)),
    [rangeStart]
  );
  const eventsByDay = useMemo(() => groupEventsByDay(events), [events]);

  const handlePrev = () => { setDirection(-1); setRangeStart((d) => addDays(d, -28)); };
  const handleNext = () => { setDirection(1);  setRangeStart((d) => addDays(d, 28)); };

  const handleDayClick = (day: Date) => { setFocusEvent(null); setSelectedDay(day); };
  const handleEventClick = (event: NormalizedCalendarEvent) => {
    setFocusEvent(event);
    setSelectedDay(new Date(event.start));
  };

  const periodLabel = `${format(rangeStart, "d MMM", { locale: ptBR })} – ${format(rangeEnd, "d MMM", { locale: ptBR })}`;
  const selectedDayKey = selectedDay ? format(selectedDay, "yyyy-MM-dd") : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 flex flex-shrink-0 items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold leading-tight" style={{ color: "#b4b4b4" }}>
            Agenda Semanal
          </p>
          <p className="text-[10px] capitalize text-[var(--muted-foreground)]">{periodLabel}</p>
        </div>
        {connected && !isLoading && (
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              aria-label="Período anterior"
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-white/[0.06]"
            >
              <ChevronLeft size={16} style={{ color: "var(--muted-foreground)" }} />
            </button>
            <button
              onClick={handleNext}
              aria-label="Próximo período"
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-white/[0.06]"
            >
              <ChevronRight size={16} style={{ color: "var(--muted-foreground)" }} />
            </button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1">
        {isLoading ? (
          <AgendaSkeleton />
        ) : !connected ? (
          <AgendaDisconnectedState />
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            {error && (
              <p className="mb-2 flex-shrink-0 text-[11px]" style={{ color: "#fe7b4a" }}>
                Não foi possível atualizar a agenda agora.
              </p>
            )}
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={format(rangeStart, "yyyy-MM-dd")}
                custom={direction}
                variants={shouldReduce ? PANEL_VARIANTS_REDUCED : PANEL_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                className="h-full min-h-0"
              >
                <AgendaDesktopGrid
                  days={days}
                  eventsByDay={eventsByDay}
                  onDayClick={handleDayClick}
                  onEventClick={handleEventClick}
                />
                <AgendaMobileCarousel
                  days={days}
                  eventsByDay={eventsByDay}
                  onDayClick={handleDayClick}
                  onEventClick={handleEventClick}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedDay && (
          <DayDetailDrawer
            day={selectedDay}
            events={selectedDayKey ? (eventsByDay.get(selectedDayKey) ?? []) : []}
            initialFocusEvent={focusEvent}
            onClose={() => { setSelectedDay(null); setFocusEvent(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
