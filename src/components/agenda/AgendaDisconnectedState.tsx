"use client";

import { CalendarOff, Link2 } from "lucide-react";

export function AgendaDisconnectedState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <CalendarOff size={28} style={{ color: "var(--muted-foreground)" }} />
      <div>
        <p className="text-sm font-medium" style={{ color: "var(--text-title)" }}>
          Nenhum calendário conectado
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
          Conecte seu Google Calendar para visualizar sua agenda diretamente no Dashboard.
        </p>
      </div>
      <button
        onClick={() => { window.location.href = "/api/google-calendar/connect"; }}
        className="flex items-center gap-2 self-center rounded-xl px-3 py-2 text-sm font-medium transition-all active:scale-95"
        style={{ background: "#b0b8c1", color: "#000000" }}
      >
        <Link2 size={14} />
        Conectar Google Calendar
      </button>
    </div>
  );
}
