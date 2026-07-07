"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Calendar, MoreHorizontal, Archive, Clock, Globe, Link2, Check } from "lucide-react";
import type { AppointmentCalendar } from "@/types/appointments";

interface CalendarCardProps {
  calendar:  AppointmentCalendar;
  onArchive: (id: string) => void;
}

export function CalendarCard({ calendar, onArchive }: CalendarCardProps) {
  const router   = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied,   setCopied]   = useState(false);

  function handleCopyLink(e: React.MouseEvent) {
    e.stopPropagation();
    const url = `${window.location.origin}/agendar/${calendar.slug}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="relative group p-4 cursor-pointer lc-card"
      onClick={() => router.push(`/agendamentos/${calendar.id}`)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <Calendar size={14} style={{ color: "var(--text-title)" }} />
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{
              background: calendar.status === "active"
                ? "rgba(34,197,94,0.12)"
                : "var(--border)",
              color: calendar.status === "active" ? "#22c55e" : "var(--muted-foreground)",
            }}
          >
            {calendar.status === "active" ? "Ativo" : "Arquivado"}
          </span>

          {/* Context menu */}
          <div className="relative">
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); }}
              className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--hover)]"
            >
              <MoreHorizontal size={14} style={{ color: "var(--muted-foreground)" }} />
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={e => { e.stopPropagation(); setMenuOpen(false); }}
                />
                <div
                  className="absolute right-0 top-full mt-1 z-20 min-w-[160px] rounded-xl overflow-hidden"
                  style={{
                    background:           "var(--bg-tooltip)",
                    backdropFilter:       "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    border:               "1px solid var(--border-tooltip)",
                    boxShadow:            "0 12px 40px var(--shadow-lg)",
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--hover)] transition-colors"
                    style={{ color: "var(--muted-foreground)" }}
                    onClick={e => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onArchive(calendar.id);
                    }}
                  >
                    <Archive size={13} />
                    Arquivar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Name + description */}
      <div className="mb-3">
        <h3
          className="font-semibold text-sm mb-1 truncate"
          style={{ color: "var(--text-title)" }}
        >
          {calendar.name}
        </h3>
        {calendar.description && (
          <p
            className="text-xs line-clamp-2"
            style={{ color: "var(--muted-foreground)" }}
          >
            {calendar.description}
          </p>
        )}
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
        <span className="flex items-center gap-1">
          <Clock size={11} />
          {calendar.duration_minutes} min
        </span>
        <span className="flex items-center gap-1">
          <Globe size={11} />
          {calendar.timezone.replace("America/", "")}
        </span>
      </div>

      {/* Footer */}
      <div
        className="mt-3 pt-3 flex items-center justify-between text-xs"
        style={{ borderTop: "1px solid var(--border)", color: "var(--muted-foreground)" }}
      >
        <span>Criado em {formatDate(calendar.created_at)}</span>

        <button
          onClick={handleCopyLink}
          title="Copiar link público"
          className="flex items-center gap-1 px-2 py-1 rounded-lg transition-all active:scale-95"
          style={{
            color:      copied ? "#22c55e" : "var(--muted-foreground)",
            background: copied ? "rgba(34,197,94,0.1)" : "transparent",
          }}
        >
          {copied
            ? <><Check size={11} /><span>Copiado!</span></>
            : <><Link2 size={11} /><span>Copiar link</span></>}
        </button>
      </div>
    </motion.div>
  );
}
