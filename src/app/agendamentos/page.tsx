"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Plus, Loader2 } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { CalendarCard }         from "@/components/appointments/CalendarCard";
import { CreateCalendarModal }  from "@/components/appointments/CreateCalendarModal";
import { useCalendars }         from "@/hooks/useCalendars";

export default function AgendamentosPage() {
  const {
    calendars, isLoading, error,
    createCalendar, archiveCalendar,
  } = useCalendars();

  const [showCreate, setShowCreate] = useState(false);

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Agendamentos" subtitle="Gerencie seus calendários de agendamento" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <Header
        title="Agendamentos"
        subtitle="Gerencie seus calendários de agendamento"
      />

      <div className="px-4 sm:px-6 pt-2 pb-4">
        {/* Action bar */}
        <div className="flex items-center justify-between mb-6">
          <div />
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 hover:opacity-90"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            <Plus size={14} />
            Novo calendário
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-400 mb-4">{error}</p>
        )}

        {calendars.length === 0 ? (
          <EmptyState onNew={() => setShowCreate(true)} />
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {calendars.map(cal => (
              <CalendarCard
                key={cal.id}
                calendar={cal}
                onArchive={archiveCalendar}
              />
            ))}
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showCreate && (
          <CreateCalendarModal
            onClose={() => setShowCreate(false)}
            onCreate={createCalendar}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div
        className="p-4 rounded-2xl mb-4"
        style={{ background: "var(--accent)" }}
      >
        <Calendar size={28} style={{ color: "var(--primary)" }} />
      </div>
      <h3
        className="font-semibold text-base mb-2"
        style={{ color: "var(--text-title)" }}
      >
        Nenhum calendário criado
      </h3>
      <p
        className="text-sm mb-5 max-w-xs"
        style={{ color: "var(--muted-foreground)" }}
      >
        Crie seu primeiro calendário de agendamento e comece a receber reservas.
      </p>
      <button
        onClick={onNew}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95"
        style={{ background: "var(--primary)", color: "#fff" }}
      >
        <Plus size={14} />
        Novo calendário
      </button>
    </div>
  );
}
