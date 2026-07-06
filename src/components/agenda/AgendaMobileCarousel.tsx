"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AgendaEventBar } from "./AgendaEventBar";
import type { EventsByDay } from "./constants";
import type { NormalizedCalendarEvent } from "@/types/google-calendar";

const MOBILE_MAX_EVENTS = 8;

interface AgendaMobileCarouselProps {
  days:         Date[];
  eventsByDay:  EventsByDay;
  onDayClick:   (day: Date) => void;
  onEventClick: (event: NormalizedCalendarEvent) => void;
}

export function AgendaMobileCarousel({ days, eventsByDay, onDayClick, onEventClick }: AgendaMobileCarouselProps) {
  const initialIndex = useMemo(() => {
    const idx = days.findIndex((d) => isToday(d));
    return idx >= 0 ? idx : 0;
  }, [days]);

  const [index, setIndex] = useState(initialIndex);
  const [dir, setDir]     = useState(1);

  const day = days[index];
  const dayKey = format(day, "yyyy-MM-dd");
  const events = eventsByDay.get(dayKey) ?? [];
  const overflow = events.length > MOBILE_MAX_EVENTS;
  const visible = overflow ? events.slice(0, MOBILE_MAX_EVENTS) : events;

  const goPrev = () => { setDir(-1); setIndex((i) => Math.max(0, i - 1)); };
  const goNext = () => { setDir(1);  setIndex((i) => Math.min(days.length - 1, i + 1)); };

  return (
    <div className="md:hidden">
      <div className="mb-3 flex items-center justify-between px-1">
        <button onClick={goPrev} disabled={index === 0} aria-label="Dia anterior" className="disabled:opacity-30">
          <ChevronLeft size={18} style={{ color: "var(--muted-foreground)" }} />
        </button>
        <span className="text-xs font-medium capitalize" style={{ color: "var(--text-title)" }}>
          {format(day, "EEEE, d 'de' MMMM", { locale: ptBR })}
        </span>
        <button onClick={goNext} disabled={index === days.length - 1} aria-label="Próximo dia" className="disabled:opacity-30">
          <ChevronRight size={18} style={{ color: "var(--muted-foreground)" }} />
        </button>
      </div>

      <AnimatePresence mode="wait" custom={dir}>
        <motion.button
          key={dayKey}
          onClick={() => onDayClick(day)}
          custom={dir}
          initial={{ opacity: 0, x: dir > 0 ? 24 : -24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir > 0 ? -24 : 24 }}
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          className="flex w-full flex-col gap-1.5 rounded-2xl p-3 text-left"
          style={{
            background: isToday(day) ? "rgba(0,0,0,0.62)" : "rgba(0,0,0,0.31)",
            border:     `1px solid ${isToday(day) ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.09)"}`,
            minHeight:  120,
          }}
        >
          {visible.length === 0 && (
            <span className="text-xs opacity-40" style={{ color: "var(--muted-foreground)" }}>
              Sem eventos
            </span>
          )}
          {visible.map((event) => (
            <AgendaEventBar key={event.id} event={event} onClick={onEventClick} />
          ))}
          {overflow && (
            <span className="text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>
              +{events.length - visible.length} · Ver tudo
            </span>
          )}
        </motion.button>
      </AnimatePresence>

      <div className="mt-3 flex items-center justify-center gap-1">
        {days.map((d, i) => (
          <span
            key={i}
            className="h-1 rounded-full transition-all"
            style={{
              width:      i === index ? 12 : 4,
              background: i === index ? "var(--primary)" : "rgba(255,255,255,0.12)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
