"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { CalendarDays, Plus, Bell } from "lucide-react";
import type { useWorkspaceTasks } from "@/hooks/useWorkspaceTasks";

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Data escrita: "Domingo | 05 de Julho" ───────────────────────────────────

function DateBadge() {
  const now = new Date();
  const weekday = capitalize(format(now, "EEEE", { locale: ptBR }));
  const dayMonth = format(now, "d 'de' MMMM", { locale: ptBR });

  return (
    <div
      className="lc-card hidden items-center gap-2 px-3.5 py-2 text-sm sm:flex"
      style={{ background: "rgba(0,0,0,0.31)" }}
    >
      <CalendarDays size={14} style={{ color: "var(--muted-foreground)" }} />
      <span style={{ color: "var(--text-title)" }}>{weekday} | {dayMonth}</span>
    </div>
  );
}

// ── + Nova Tarefa (quick add) ───────────────────────────────────────────────

interface QuickAddTaskButtonProps {
  tasksHook: ReturnType<typeof useWorkspaceTasks>;
}

function QuickAddTaskButton({ tasksHook }: QuickAddTaskButtonProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.right - 260 });
    }
    setOpen((o) => !o);
  };

  async function handleAdd() {
    const trimmed = title.trim();
    if (!trimmed) return;
    setTitle("");
    setOpen(false);
    await tasksHook.createTask({ title: trimmed });
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-transform hover:-translate-y-px"
        style={{ background: "#b0b8c1", color: "#000000" }}
      >
        <Plus size={15} />
        Nova Tarefa
      </button>

      {mounted && createPortal(
        <AnimatePresence>
          {open && (
            <>
              <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.12 }}
                style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999, width: 260 }}
              >
                <div
                  className="rounded-xl p-2 shadow-2xl"
                  style={{
                    background: "rgba(0,0,0,0.10)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    backdropFilter: "blur(24px)",
                    WebkitBackdropFilter: "blur(24px)",
                  }}
                >
                  <input
                    ref={inputRef}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); if (e.key === "Escape") setOpen(false); }}
                    placeholder="Título da tarefa..."
                    className="w-full rounded-lg bg-white/[0.04] px-3 py-2 text-sm outline-none placeholder:text-[var(--muted-foreground)]"
                    style={{ color: "var(--text-title)" }}
                  />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

// ── Sino de notificações (visual, sem central de notificações ainda) ───────

function NotificationBell() {
  return (
    <button
      className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/[0.06]"
      aria-label="Notificações"
    >
      <Bell size={16} style={{ color: "var(--muted-foreground)" }} />
      <span
        className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full"
        style={{ background: "#ef4444" }}
      />
    </button>
  );
}

// ── Avatar → configurações do usuário ───────────────────────────────────────

interface UserAvatarLinkProps {
  name:      string | null;
  avatarUrl: string | null;
}

function UserAvatarLink({ name, avatarUrl }: UserAvatarLinkProps) {
  const initial = (name ?? "?").trim().slice(0, 1).toUpperCase();

  return (
    <Link
      href="/configuracoes/perfil"
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold transition-transform hover:scale-105"
      style={{ background: "var(--primary)", color: "#ffffff" }}
      aria-label="Configurações do usuário"
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={name ?? "Usuário"} className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </Link>
  );
}

// ── Composição ───────────────────────────────────────────────────────────────

interface DashboardHeaderActionsProps {
  tasksHook: ReturnType<typeof useWorkspaceTasks>;
  name:      string | null;
  avatarUrl: string | null;
}

export function DashboardHeaderActions({ tasksHook, name, avatarUrl }: DashboardHeaderActionsProps) {
  return (
    <>
      <DateBadge />
      <QuickAddTaskButton tasksHook={tasksHook} />
      <NotificationBell />
      <UserAvatarLink name={name} avatarUrl={avatarUrl} />
    </>
  );
}
