"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { ArrowUpRight, Calendar as CalendarIcon } from "lucide-react";
import { useGoogleCalendarEvents } from "@/hooks/useGoogleCalendarEvents";
import { AgendaDisconnectedState } from "@/components/agenda/AgendaDisconnectedState";
import { AGENDA_BAR_COLOR } from "@/components/agenda/constants";

export function TodayAgendaCard({ delay = 0 }: { delay?: number }) {
  const router = useRouter();
  const today = useMemo(() => startOfDay(new Date()), []);
  const { events, connected, isLoading } = useGoogleCalendarEvents(today, today);
  const todayKey = format(today, "yyyy-MM-dd");

  function openInAgenda() {
    router.push(`/agendamentos?tab=agendamentos&from_date=${todayKey}&to_date=${todayKey}`);
  }

  return (
    <motion.div
      className="lc-card p-6"
      style={{ background: "var(--glass-bg-soft)" }}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl">
            <CalendarIcon size={17} style={{ color: "var(--text-title)" }} />
          </div>
          <div>
            <p className="text-[13px] font-semibold leading-tight" style={{ color: "var(--silver)" }}>Agenda de Hoje</p>
            <p className="text-[10px] text-[var(--muted-foreground)]">
              {format(today, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
        </div>
        {connected && (
          <button onClick={openInAgenda} className="text-[var(--muted-foreground)] hover:text-[var(--text-title)]">
            <ArrowUpRight size={15} />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-9 animate-pulse rounded-lg" style={{ background: "var(--shimmer-base)" }} />)}
        </div>
      ) : !connected ? (
        <AgendaDisconnectedState />
      ) : events.length === 0 ? (
        <p className="py-6 text-center text-xs" style={{ color: "var(--muted-foreground)" }}>
          Nenhum compromisso hoje
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {events.map((event) => (
            <button
              key={event.id}
              onClick={openInAgenda}
              className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-[var(--hover)]"
            >
              <span className="h-8 w-1 flex-shrink-0 rounded-full" style={{ background: AGENDA_BAR_COLOR }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm" style={{ color: "var(--text-title)" }}>{event.title}</p>
                <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                  {event.isAllDay ? "Dia inteiro" : `${format(new Date(event.start), "HH:mm")} – ${format(new Date(event.end), "HH:mm")}`}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
