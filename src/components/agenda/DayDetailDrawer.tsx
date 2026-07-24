"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    if (!portalReady) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, portalReady]);

  const dayKey = format(day, "yyyy-MM-dd");

  const openInAgenda = () => {
    router.push(`/agendamentos?tab=agendamentos&from_date=${dayKey}&to_date=${dayKey}`);
  };

  if (!portalReady) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] isolate flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="lc-modal-backdrop absolute inset-0"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
        className="lc-modal-panel relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-3xl sm:max-h-[min(90dvh,760px)]"
        role="dialog"
        aria-modal="true"
        aria-label={`Agenda de ${format(day, "d 'de' MMMM", { locale: ptBR })}`}
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
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
    </div>,
    document.body,
  );
}
