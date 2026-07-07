"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X, ChevronLeft, ArrowUpRight } from "lucide-react";
import { EventDetailView } from "./EventDetailView";
import type { NormalizedCalendarEvent } from "@/types/google-calendar";

interface DayDetailDrawerProps {
  day:                Date;
  events:             NormalizedCalendarEvent[];
  initialFocusEvent?: NormalizedCalendarEvent | null;
  onClose:            () => void;
}

export function DayDetailDrawer({ day, events, initialFocusEvent, onClose }: DayDetailDrawerProps) {
  const router = useRouter();
  const [focusEvent, setFocusEvent] = useState<NormalizedCalendarEvent | null>(initialFocusEvent ?? null);

  const dayKey = format(day, "yyyy-MM-dd");

  const openInAgenda = () => {
    router.push(`/agendamentos?tab=agendamentos&from_date=${dayKey}&to_date=${dayKey}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex-1 lc-scrim"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="lc-modal-panel flex h-full w-full max-w-md flex-shrink-0 flex-col"
        style={{ borderLeft: "1px solid var(--border-modal)" }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex flex-shrink-0 items-center gap-3 px-5 py-4"
          style={{ background: "var(--bg-modal)", borderBottom: "1px solid var(--border-modal)" }}
        >
          {focusEvent ? (
            <button onClick={() => setFocusEvent(null)} aria-label="Voltar">
              <ChevronLeft size={18} style={{ color: "var(--muted-foreground)" }} />
            </button>
          ) : null}
          <p className="min-w-0 flex-1 truncate text-sm font-semibold capitalize" style={{ color: "var(--text-title)" }}>
            {format(day, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
          <button onClick={onClose} aria-label="Fechar">
            <X size={18} style={{ color: "var(--muted-foreground)" }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {focusEvent ? (
              <motion.div
                key="detail"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <EventDetailView event={focusEvent} />
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col gap-1 px-3 py-3"
              >
                {events.length === 0 && (
                  <p className="px-2 py-6 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
                    Sem eventos neste dia
                  </p>
                )}
                {events.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => setFocusEvent(event)}
                    className="flex flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--hover)]"
                  >
                    <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                      {event.isAllDay ? "Dia inteiro" : format(parseISO(event.start), "HH:mm")}
                    </span>
                    <span className="truncate text-sm font-medium" style={{ color: "var(--text-title)" }}>
                      {event.title}
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div
          className="flex-shrink-0 px-5 py-4"
          style={{ borderTop: "1px solid var(--border-modal)" }}
        >
          <button
            onClick={openInAgenda}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all active:scale-95"
            style={{ background: "#b0b8c1", color: "#000000" }}
          >
            Abrir na Agenda
            <ArrowUpRight size={14} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
