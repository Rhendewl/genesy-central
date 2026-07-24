"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Archive, Check, Clock, Link2, MoreHorizontal } from "lucide-react";
import { GlassCalendarIcon } from "@/components/ui/GlassCalendarIcon";
import type { AppointmentCalendar } from "@/types/appointments";

export function CalendarCard({ calendar, onArchive }: { calendar: AppointmentCalendar; onArchive: (id: string) => void }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const color = calendar.status === "active" ? "#4a8fd4" : "#75828e";

  function handleCopyLink(event: React.MouseEvent) {
    event.stopPropagation();
    void navigator.clipboard.writeText(`${window.location.origin}/agendar/${calendar.slug}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.985 }}
      className="glass-folder-card group relative aspect-square min-w-0 cursor-pointer overflow-hidden rounded-[20px] border p-3 text-center"
      style={{ "--folder-color": color } as React.CSSProperties}
      onClick={() => router.push(`/agendamentos/${calendar.id}`)}
    >
      <div className="glass-folder-glow pointer-events-none absolute inset-0 opacity-70" style={{ "--folder-color": color } as React.CSSProperties} />

      <span className={`calendar-status-badge absolute left-2.5 top-2.5 z-10 rounded-full px-2 py-0.5 text-[9px] font-medium backdrop-blur-xl ${calendar.status === "active" ? "calendar-status-badge--active" : "calendar-status-badge--archived"}`}>
        {calendar.status === "active" ? "Ativo" : "Arquivado"}
      </span>

      <div className="absolute right-2 top-2 z-30">
        <button type="button" onClick={(event) => { event.stopPropagation(); setMenuOpen((current) => !current); }} className="flex h-7 w-7 items-center justify-center rounded-lg border bg-[var(--hover)] text-[var(--muted-foreground)] backdrop-blur-xl sm:opacity-70 sm:group-hover:opacity-100" style={{ borderColor: "var(--glass-border)" }} aria-label={`Opções de ${calendar.name}`}>
          <MoreHorizontal size={13} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={(event) => { event.stopPropagation(); setMenuOpen(false); }} />
            <div className="lc-modal-panel absolute right-0 top-9 z-20 min-w-36 overflow-hidden rounded-xl py-1 text-left">
              <button type="button" onClick={(event) => { event.stopPropagation(); setMenuOpen(false); onArchive(calendar.id); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--muted-foreground)] hover:bg-[var(--hover)]">
                <Archive size={12} /> Arquivar
              </button>
            </div>
          </>
        )}
      </div>

      <div className="relative flex h-full min-w-0 flex-col items-center justify-center px-1 pb-7 pt-5">
        <GlassCalendarIcon color={color} className="h-16 w-16 sm:h-20 sm:w-20" />
        <h3 className="mt-[-2px] w-full truncate text-xs font-semibold text-[var(--text-title)] sm:text-sm">{calendar.name}</h3>
        <p className="mt-1 flex max-w-full items-center gap-1 truncate text-[10px] text-[var(--muted-foreground)] sm:text-[11px]"><Clock size={10} className="shrink-0" />{calendar.duration_minutes} min<span className="hidden sm:inline">· {calendar.timezone.replace("America/", "")}</span></p>
      </div>

      <button type="button" onClick={handleCopyLink} className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-lg px-2 py-1 text-[9px] transition-colors hover:bg-[var(--hover)] sm:text-[10px]" style={{ color: copied ? "#22c55e" : "var(--muted-foreground)" }}>
        {copied ? <Check size={10} /> : <Link2 size={10} />}{copied ? "Copiado" : "Copiar link"}
      </button>
    </motion.article>
  );
}
