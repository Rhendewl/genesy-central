"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { CalendarDays, ClipboardCheck, Bell, CheckCheck, Inbox, Trash2 } from "lucide-react";
import type { useWorkspaceTasks } from "@/hooks/useWorkspaceTasks";
import { Button } from "@/components/ui/button";

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
      style={{ background: "var(--glass-bg-soft)" }}
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
      <Button
        ref={btnRef}
        onClick={handleToggle}
        icon={<ClipboardCheck />}
        signature
        size="medium"
      >
        Nova Tarefa
      </Button>

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
                    background: "var(--glass-bg)",
                    border: "1px solid var(--glass-border)",
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
                    className="w-full rounded-lg bg-[var(--input)] px-3 py-2 text-sm outline-none placeholder:text-[var(--muted-foreground)]"
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

// ── Sino de notificações ────────────────────────────────────────────────────

interface PlatformNotification {
  id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  lead_id: string | null;
  automation_id: string | null;
  source: string;
  task_id: string | null;
  action_url: string | null;
}

function playNotificationTone() {
  try {
    const AudioContextCtor =
      window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextCtor) return;

    const audio = new AudioContextCtor();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audio.currentTime);
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, audio.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.16);

    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.18);

    window.setTimeout(() => void audio.close(), 250);
  } catch {
    // O navegador pode bloquear áudio até haver interação do usuário.
  }
}

function formatNotificationDate(date: string) {
  try {
    return format(new Date(date), "dd/MM HH:mm", { locale: ptBR });
  } catch {
    return "";
  }
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const hasInitialLoadRef = useRef(false);

  useEffect(() => { setMounted(true); }, []);

  const positionPanel = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const panelWidth = Math.min(340, window.innerWidth - 24);
    const maxLeft = Math.max(12, window.innerWidth - panelWidth - 12);
    setPos({
      top: r.bottom + 8,
      left: Math.min(Math.max(12, r.right - panelWidth), maxLeft),
    });
  }, []);

  const fetchNotifications = useCallback(async (playSoundForNew = false) => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/notifications?limit=20", { cache: "no-store" });
      if (!response.ok) return;

      const payload = await response.json() as {
        notifications?: PlatformNotification[];
        unreadCount?: number;
      };
      const nextNotifications = payload.notifications ?? [];
      const nextIds = new Set(nextNotifications.map((notification) => notification.id));
      const hasNewNotification = nextNotifications.some(
        (notification) => !knownIdsRef.current.has(notification.id)
      );

      if (
        playSoundForNew &&
        hasInitialLoadRef.current &&
        hasNewNotification &&
        document.visibilityState === "visible"
      ) {
        playNotificationTone();
      }

      knownIdsRef.current = nextIds;
      hasInitialLoadRef.current = true;
      setNotifications(nextNotifications);
      setUnreadCount(payload.unreadCount ?? 0);
    } catch {
      // Durante recompilações locais ou oscilações de rede, mantém o último
      // estado conhecido e deixa a próxima consulta periódica tentar de novo.
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async () => {
    if (unreadCount === 0) return;

    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;

    setUnreadCount(0);
    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        read_at: notification.read_at ?? new Date().toISOString(),
      }))
    );

    try {
      const response = await fetch("/api/notifications", { method: "PATCH" });
      if (!response.ok) throw new Error("Falha ao marcar notificações como lidas");
    } catch {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
    }
  }, [notifications, unreadCount]);

  const clearNotifications = useCallback(async () => {
    if (notifications.length === 0 || isClearing) return;

    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;

    setIsClearing(true);
    setNotifications([]);
    setUnreadCount(0);
    knownIdsRef.current = new Set();

    try {
      const response = await fetch("/api/notifications", { method: "DELETE" });
      if (!response.ok) throw new Error("Falha ao limpar notificações");
    } catch {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      knownIdsRef.current = new Set(previousNotifications.map((notification) => notification.id));
    } finally {
      setIsClearing(false);
    }
  }, [isClearing, notifications, unreadCount]);

  useEffect(() => {
    void fetchNotifications(false);
    const interval = window.setInterval(() => {
      void fetchNotifications(true);
    }, 15000);

    return () => window.clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    positionPanel();
    const timeout = window.setTimeout(() => void markAsRead(), 500);
    window.addEventListener("resize", positionPanel);
    window.addEventListener("scroll", positionPanel, true);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("resize", positionPanel);
      window.removeEventListener("scroll", positionPanel, true);
    };
  }, [markAsRead, open, positionPanel]);

  const handleToggle = () => {
    if (!open) {
      positionPanel();
      void fetchNotifications(false);
    }
    setOpen((current) => !current);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--hover)]"
        aria-label="Notificações"
        aria-expanded={open}
      >
        <Bell size={16} style={{ color: "var(--muted-foreground)" }} />
        {unreadCount > 0 && (
          <span
            className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold"
            style={{ background: "#ef4444", color: "#ffffff" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {mounted && createPortal(
        <AnimatePresence>
          {open && (
            <>
              <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.14 }}
                style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999, width: "min(340px, calc(100vw - 24px))" }}
              >
                <div className="lc-modal-panel overflow-hidden rounded-2xl shadow-2xl">
                  <div
                    className="flex items-center justify-between border-b px-4 py-3"
                    style={{ borderColor: "var(--glass-border)" }}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>
                        Notificações
                      </p>
                      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                        Atualizações recentes da plataforma
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {notifications.length > 0 && (
                        <button
                          type="button"
                          onClick={() => void clearNotifications()}
                          disabled={isClearing}
                          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors hover:bg-[var(--hover)] disabled:cursor-not-allowed disabled:opacity-50"
                          style={{ color: "var(--muted-foreground)" }}
                          aria-label="Limpar notificações"
                        >
                          <Trash2 size={13} />
                          {isClearing ? "Limpando..." : "Limpar"}
                        </button>
                      )}
                      <CheckCheck size={16} style={{ color: unreadCount > 0 ? "var(--primary)" : "var(--muted-foreground)" }} />
                    </div>
                  </div>

                  <div className="max-h-[360px] overflow-y-auto p-2">
                    {isLoading && notifications.length === 0 ? (
                      <div className="px-3 py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
                        Carregando notificações...
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                        <Inbox size={22} style={{ color: "var(--muted-foreground)" }} />
                        <p className="text-sm font-medium" style={{ color: "var(--text-title)" }}>
                          Nenhuma notificação
                        </p>
                        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                          Quando algo novo acontecer, aparece aqui.
                        </p>
                      </div>
                    ) : (
                      notifications.map((notification) => {
                        const content = (
                          <div className="flex items-start gap-2">
                            <span
                              className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full"
                              style={{ background: notification.read_at ? "var(--border)" : "#ef4444" }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-semibold leading-snug" style={{ color: "var(--text-title)" }}>
                                  {notification.title}
                                </p>
                                <span className="whitespace-nowrap text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                                  {formatNotificationDate(notification.created_at)}
                                </span>
                              </div>
                              <p className="mt-1 line-clamp-2 text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                                {notification.body}
                              </p>
                            </div>
                          </div>
                        );

                        return notification.action_url ? (
                          <Link
                            key={notification.id}
                            href={notification.action_url}
                            onClick={() => {
                              setOpen(false);
                              void markAsRead();
                            }}
                            className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--hover)]"
                          >
                            {content}
                          </Link>
                        ) : (
                          <div key={notification.id} className="rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--hover)]">
                            {content}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
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
      href="/configuracoes/meu-perfil"
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold transition-transform hover:scale-105"
      style={{ background: "var(--primary)", color: "#ffffff" }}
      aria-label="Meu Perfil"
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
