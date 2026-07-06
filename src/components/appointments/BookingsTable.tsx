"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search, X, Loader2, Inbox, RefreshCw,
  Check, CheckCircle2, UserX, Copy, ExternalLink,
  ChevronLeft, ChevronRight, Filter,
} from "lucide-react";
import { useCalendars } from "@/hooks/useCalendars";
import type {
  BookingWithCalendar,
  AppointmentBookingHistory,
  AppointmentCustomField,
  BookingStatus,
} from "@/types/appointments";

// ── Constants ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: "Pendente",   color: "#f59e0b", bg: "rgba(245,158,11,0.12)"  },
  confirmed:   { label: "Confirmado", color: "#22c55e", bg: "rgba(34,197,94,0.12)"   },
  cancelled:   { label: "Cancelado",  color: "#ef4444", bg: "rgba(239,68,68,0.12)"   },
  completed:   { label: "Concluído",  color: "#6366f1", bg: "rgba(99,102,241,0.12)"  },
  no_show:     { label: "No-show",    color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
  rescheduled: { label: "Reagendado", color: "#64748b", bg: "rgba(100,116,139,0.12)" },
};

const HISTORY_CFG: Record<string, { label: string; dot: string }> = {
  created:            { label: "Agendamento criado",        dot: "#94a3b8" },
  confirmed:          { label: "Confirmado",                dot: "#22c55e" },
  cancelled:          { label: "Cancelado",                 dot: "#ef4444" },
  completed:          { label: "Concluído",                 dot: "#6366f1" },
  no_show:            { label: "No-show registrado",        dot: "#94a3b8" },
  rescheduled:        { label: "Reagendado",                dot: "#64748b" },
  note_added:         { label: "Nota adicionada",           dot: "#64748b" },
  google_synced:      { label: "Sincronizado c/ Google",    dot: "#4285f4" },
  google_sync_failed: { label: "Falha na sincronização",    dot: "#ef4444" },
  email_sent:         { label: "E-mail enviado",            dot: "#64748b" },
  reminder_sent:      { label: "Lembrete enviado",          dot: "#64748b" },
  webhook_delivered:  { label: "Webhook entregue",          dot: "#22c55e" },
  webhook_failed:     { label: "Falha no webhook",          dot: "#ef4444" },
  status_changed:     { label: "Status alterado",           dot: "#64748b" },
};

// Valid status transitions (mirrors server)
const VALID_NEXT: Partial<Record<string, BookingStatus[]>> = {
  pending:     ["confirmed", "cancelled"],
  confirmed:   ["completed", "no_show", "cancelled"],
  rescheduled: ["cancelled"],
};

const COL = "1.6fr 1.6fr 0.9fr 1.2fr 0.8fr 0.6fr 0.95fr 0.95fr";

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function getOriginLabel(b: BookingWithCalendar): string {
  const url = b.attribution?.page_url;
  if (url?.includes("/agendar/")) return "Página Pública";
  if (url) return "Link direto";
  return "Manual";
}

// ── Shared mini-components ────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, color: "rgba(255,255,255,0.5)", bg: "rgba(255,255,255,0.08)" };
  return (
    <span
      className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {cfg.label}
    </span>
  );
}

function SectionHead({ title }: { title: string }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest mb-2 mt-5 first:mt-0" style={{ color: "var(--muted-foreground)" }}>
      {title}
    </p>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-start gap-4 py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span className="text-xs flex-shrink-0" style={{ color: "var(--muted-foreground)" }}>{label}</span>
      <span className="text-xs font-medium text-right break-all" style={{ color: "var(--text-title)" }}>{value}</span>
    </div>
  );
}

function TimelineItem({ label, date, dot, sub }: { label: string; date: string; dot: string; sub?: string }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1" style={{ background: dot }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium" style={{ color: "var(--text-title)" }}>{label}</span>
          <span className="text-xs flex-shrink-0" style={{ color: "var(--muted-foreground)" }}>{fmtDateTime(date)}</span>
        </div>
        {sub && <p className="text-[10px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>{sub}</p>}
      </div>
    </div>
  );
}

function ActionBtn({
  icon, label, onClick, color, disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all disabled:opacity-40 shrink-0"
      style={{ background: `${color}14`, color, border: `1px solid ${color}25` }}
    >
      {icon}
      {label}
    </button>
  );
}

// ── History tab (fetches from API) ────────────────────────────────────────────

function HistoryTab({ bookingId, fallback }: { bookingId: string; fallback: BookingWithCalendar }) {
  const [entries,   setEntries]   = useState<AppointmentBookingHistory[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetch(`/api/appointments/bookings/${bookingId}`)
      .then(r => r.json())
      .then((data: { history?: AppointmentBookingHistory[] }) => {
        if (!cancelled) setEntries(data.history ?? []);
      })
      .catch(() => { if (!cancelled) setEntries([]); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [bookingId]);

  if (isLoading) {
    return (
      <div className="py-10 flex justify-center">
        <Loader2 size={16} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />
      </div>
    );
  }

  const showFallback = !entries || entries.length === 0;

  return (
    <div>
      <SectionHead title="Timeline" />

      {showFallback ? (
        // Fallback: read timestamps from the booking row itself
        <div className="space-y-0">
          <TimelineItem label="Criado"    date={fallback.created_at}  dot="#94a3b8" sub="Sistema" />
          {fallback.confirmed_at && <TimelineItem label="Confirmado"  date={fallback.confirmed_at} dot="#22c55e" />}
          {fallback.completed_at && <TimelineItem label="Concluído"   date={fallback.completed_at} dot="#6366f1" />}
          {fallback.cancelled_at && (
            <TimelineItem
              label="Cancelado"
              date={fallback.cancelled_at}
              dot="#ef4444"
              sub={fallback.cancellation_reason ?? undefined}
            />
          )}
          {fallback.status === "no_show"     && <TimelineItem label="No-show"    date={fallback.updated_at} dot="#94a3b8" />}
          {fallback.status === "rescheduled" && <TimelineItem label="Reagendado" date={fallback.updated_at} dot="#64748b" />}
        </div>
      ) : (
        <div className="space-y-0">
          {entries.map(entry => {
            const cfg       = HISTORY_CFG[entry.event_type] ?? { label: entry.event_type, dot: "#64748b" };
            const actorLabel =
              entry.actor === "admin"   ? "Admin"    :
              entry.actor === "visitor" ? "Visitante":
              "Sistema";
            const reason = entry.event_type === "cancelled"
              ? (entry.payload as Record<string, unknown>)?.reason as string | null
              : null;
            return (
              <TimelineItem
                key={entry.id}
                label={cfg.label}
                date={entry.created_at}
                dot={cfg.dot}
                sub={reason ? `"${reason}" · ${actorLabel}` : actorLabel}
              />
            );
          })}
        </div>
      )}

      <SectionHead title="Identificadores" />
      <InfoRow label="Booking ID"     value={fallback.id} />
      <InfoRow label="Correlation ID" value={fallback.correlation_id} />
      {fallback.rescheduled_from_id && (
        <InfoRow label="Reagend. de" value={fallback.rescheduled_from_id} />
      )}
      {fallback.google_event_id && (
        <div className="py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Google Event</span>
            <button
              type="button"
              onClick={() => window.open("https://calendar.google.com/calendar/r", "_blank")}
              className="flex items-center gap-1 text-xs font-medium"
              style={{ color: "var(--primary)" }}
            >
              <ExternalLink size={10} />
              Abrir Calendar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Drawer tabs ───────────────────────────────────────────────────────────────

type DrawerTab = "info" | "respostas" | "atribuicao" | "historico";

const DRAWER_TABS: { id: DrawerTab; label: string }[] = [
  { id: "info",       label: "Informações" },
  { id: "respostas",  label: "Respostas"   },
  { id: "atribuicao", label: "Atribuição"  },
  { id: "historico",  label: "Histórico"   },
];

// ── BookingDrawer ─────────────────────────────────────────────────────────────

function BookingDrawer({
  booking: initialBooking,
  calendarCustomFields,
  onClose,
  onStatusChange,
}: {
  booking: BookingWithCalendar;
  calendarCustomFields: AppointmentCustomField[];
  onClose: () => void;
  onStatusChange: (updated: BookingWithCalendar) => void;
}) {
  const [booking,       setBooking]       = useState(initialBooking);
  const [tab,           setTab]           = useState<DrawerTab>("info");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError,   setActionError]   = useState<string | null>(null);
  const [cancelMode,    setCancelMode]    = useState(false);
  const [cancelReason,  setCancelReason]  = useState("");
  const [copied,        setCopied]        = useState(false);

  useEffect(() => { setBooking(initialBooking); }, [initialBooking]);

  const doAction = async (status: BookingStatus, reason?: string) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res  = await fetch(`/api/appointments/bookings/${booking.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status, cancellation_reason: reason || undefined }),
      });
      const data = await res.json() as { booking?: unknown; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erro ao atualizar");
      const updated: BookingWithCalendar = {
        ...(data.booking as BookingWithCalendar),
        calendar_name: booking.calendar_name,
      };
      setBooking(updated);
      onStatusChange(updated);
      setCancelMode(false);
      setCancelReason("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setActionLoading(false);
    }
  };

  const copyMeetingLink = () => {
    if (!booking.meeting_url) return;
    void navigator.clipboard.writeText(booking.meeting_url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const responses    = (booking.custom_form_responses ?? {}) as Record<string, unknown>;
  const companyVal   = responses._company as string | undefined;
  const roleVal      = responses._role    as string | undefined;
  const cityVal      = responses._city    as string | undefined;
  const attr         = (booking.attribution ?? {}) as Record<string, string | undefined>;
  const nextStatuses = VALID_NEXT[booking.status] ?? [];

  const customFieldEntries = Object.entries(responses)
    .filter(([k]) => !k.startsWith("_"))
    .map(([k, v]) => ({
      key:   k,
      label: calendarCustomFields.find(f => f.id === k)?.label ?? k,
      value: v,
    }));

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex-1"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="w-full max-w-md h-full flex flex-col flex-shrink-0 lc-modal-panel"
        style={{ borderLeft: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          className="sticky top-0 z-10 flex items-center gap-3 px-5 py-4 flex-shrink-0"
          style={{ background: "rgba(0,0,0,0.78)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--text-title)" }}>
              {booking.visitor_name}
            </p>
            <p className="text-xs mt-0.5 truncate" style={{ color: "var(--muted-foreground)" }}>
              {booking.visitor_email}
            </p>
          </div>
          <StatusBadge status={booking.status} />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors flex-shrink-0"
          >
            <X size={14} style={{ color: "var(--muted-foreground)" }} />
          </button>
        </div>

        {/* ── Quick actions ───────────────────────────────────────────────── */}
        {(nextStatuses.length > 0 || booking.meeting_url) && !cancelMode && (
          <div
            className="px-5 py-2.5 flex flex-wrap gap-2 flex-shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
          >
            {actionLoading ? (
              <Loader2 size={14} className="animate-spin self-center" style={{ color: "var(--muted-foreground)" }} />
            ) : (
              <>
                {nextStatuses.includes("confirmed") && (
                  <ActionBtn icon={<Check size={11} />}        label="Confirmar" onClick={() => doAction("confirmed")} color="#22c55e" />
                )}
                {nextStatuses.includes("completed") && (
                  <ActionBtn icon={<CheckCircle2 size={11} />} label="Concluir"  onClick={() => doAction("completed")} color="#6366f1" />
                )}
                {nextStatuses.includes("no_show") && (
                  <ActionBtn icon={<UserX size={11} />}        label="No-show"   onClick={() => doAction("no_show")}   color="#94a3b8" />
                )}
                {nextStatuses.includes("cancelled") && (
                  <ActionBtn icon={<X size={11} />}            label="Cancelar"  onClick={() => setCancelMode(true)}   color="#ef4444" />
                )}
                {booking.meeting_url && (
                  <>
                    <ActionBtn
                      icon={copied ? <Check size={11} /> : <Copy size={11} />}
                      label={copied ? "Copiado!" : "Link da reunião"}
                      onClick={copyMeetingLink}
                      color="#64748b"
                    />
                    <ActionBtn
                      icon={<ExternalLink size={11} />}
                      label="Abrir"
                      onClick={() => window.open(booking.meeting_url!, "_blank")}
                      color="#64748b"
                    />
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Cancel confirmation inline ──────────────────────────────────── */}
        {cancelMode && (
          <div
            className="mx-5 my-3 p-3 rounded-xl flex-shrink-0 space-y-2"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}
          >
            <p className="text-xs font-medium" style={{ color: "#ef4444" }}>Confirmar cancelamento?</p>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Motivo do cancelamento (opcional)"
              rows={2}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg outline-none resize-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-title)" }}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setCancelMode(false); setCancelReason(""); }}
                className="flex-1 py-1.5 text-xs rounded-lg font-medium"
                style={{ background: "rgba(255,255,255,0.07)", color: "var(--muted-foreground)" }}
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => doAction("cancelled", cancelReason)}
                disabled={actionLoading}
                className="flex-1 py-1.5 text-xs rounded-lg font-medium disabled:opacity-50"
                style={{ background: "#ef4444", color: "#fff" }}
              >
                {actionLoading ? <Loader2 size={12} className="animate-spin mx-auto" /> : "Cancelar agendamento"}
              </button>
            </div>
          </div>
        )}

        {/* ── Action error ─────────────────────────────────────────────────── */}
        {actionError && (
          <p className="mx-5 my-1 text-xs py-1.5 px-2.5 rounded-lg flex-shrink-0" style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)" }}>
            {actionError}
          </p>
        )}

        {/* ── Tab bar ──────────────────────────────────────────────────────── */}
        <div
          className="flex flex-shrink-0 overflow-x-auto scrollbar-none"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          {DRAWER_TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="relative px-3.5 py-2.5 text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0"
              style={{ color: tab === t.id ? "var(--text-title)" : "var(--muted-foreground)" }}
            >
              {t.label}
              {tab === t.id && (
                <motion.span
                  layoutId="drawer-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                  style={{ background: "var(--primary)" }}
                />
              )}
            </button>
          ))}
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Informações */}
          {tab === "info" && (
            <div>
              <SectionHead title="Visitante" />
              <InfoRow label="Nome"     value={booking.visitor_name} />
              <InfoRow label="E-mail"   value={booking.visitor_email} />
              <InfoRow label="Telefone" value={booking.visitor_phone} />
              <InfoRow label="Empresa"  value={companyVal} />
              <InfoRow label="Cargo"    value={roleVal} />
              <InfoRow label="Cidade"   value={cityVal} />
              <InfoRow label="Timezone" value={booking.visitor_timezone} />
              {booking.visitor_notes && (
                <div className="mt-2">
                  <p className="text-[11px] mb-1.5" style={{ color: "var(--muted-foreground)" }}>Observações</p>
                  <p
                    className="text-xs p-3 rounded-xl leading-relaxed"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--text-title)" }}
                  >
                    {booking.visitor_notes}
                  </p>
                </div>
              )}

              <SectionHead title="Agendamento" />
              <InfoRow label="Calendário"  value={booking.calendar_name} />
              <InfoRow label="Data"        value={fmtDate(booking.starts_at)} />
              <InfoRow label="Hora início" value={fmtTime(booking.starts_at)} />
              <InfoRow label="Hora fim"    value={fmtTime(booking.ends_at)} />
              <InfoRow label="Status"      value={STATUS_CFG[booking.status]?.label ?? booking.status} />
              <InfoRow label="Origem"      value={getOriginLabel(booking)} />
              {booking.location     && <InfoRow label="Local"        value={booking.location} />}
              {booking.meeting_url  && <InfoRow label="Link reunião" value={booking.meeting_url} />}
              {booking.cancellation_reason && (
                <InfoRow label="Motivo cancelamento" value={booking.cancellation_reason} />
              )}
            </div>
          )}

          {/* Respostas */}
          {tab === "respostas" && (
            <div>
              {customFieldEntries.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    Nenhuma resposta de campo personalizado
                  </p>
                </div>
              ) : (
                customFieldEntries.map(({ key, label, value }) => (
                  <div key={key} className="py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <p className="text-[11px] mb-0.5" style={{ color: "var(--muted-foreground)" }}>{label}</p>
                    <p className="text-xs font-medium" style={{ color: "var(--text-title)" }}>
                      {Array.isArray(value) ? value.join(", ") : String(value ?? "—")}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Atribuição */}
          {tab === "atribuicao" && (
            <div>
              <SectionHead title="Origem" />
              <InfoRow label="Canal"      value={getOriginLabel(booking)} />
              <InfoRow label="Página URL" value={attr.page_url} />
              <InfoRow label="Referrer"   value={attr.referrer} />
              <InfoRow label="IP"         value={attr.ip} />

              {Boolean(attr.utm_source || attr.utm_medium || attr.utm_campaign) && (
                <>
                  <SectionHead title="UTMs" />
                  <InfoRow label="utm_source"   value={attr.utm_source} />
                  <InfoRow label="utm_medium"   value={attr.utm_medium} />
                  <InfoRow label="utm_campaign" value={attr.utm_campaign} />
                  <InfoRow label="utm_content"  value={attr.utm_content} />
                  <InfoRow label="utm_term"     value={attr.utm_term} />
                </>
              )}

              {Boolean(attr.fbclid || attr.gclid || attr.fbc || attr.fbp) && (
                <>
                  <SectionHead title="Tracking" />
                  <InfoRow label="fbclid" value={attr.fbclid} />
                  <InfoRow label="gclid"  value={attr.gclid} />
                  <InfoRow label="fbc"    value={attr.fbc} />
                  <InfoRow label="fbp"    value={attr.fbp} />
                </>
              )}

              {!attr.utm_source && !attr.fbclid && !attr.gclid && !attr.page_url && (
                <div className="py-12 text-center">
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    Sem dados de atribuição registrados
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Histórico — fetches from API */}
          {tab === "historico" && (
            <HistoryTab bookingId={booking.id} fallback={booking} />
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── BookingsTable ──────────────────────────────────────────────────────────────

export function BookingsTable({
  initialFromDate,
  initialToDate,
}: {
  initialFromDate?: string;
  initialToDate?:   string;
} = {}) {
  const { calendars } = useCalendars();

  const [bookings,     setBookings]     = useState<BookingWithCalendar[]>([]);
  const [total,        setTotal]        = useState(0);
  const [page,         setPage]         = useState(0);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [searchInput,  setSearchInput]  = useState("");
  const [search,       setSearch]       = useState("");
  const [calendarId,   setCalendarId]   = useState("");
  const [status,       setStatus]       = useState("");
  const [fromDate,     setFromDate]     = useState(initialFromDate ?? "");
  const [toDate,       setToDate]       = useState(initialToDate ?? "");
  const [selected,     setSelected]     = useState<BookingWithCalendar | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef    = useRef<AbortController | null>(null);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = !!(searchInput || calendarId || status || fromDate || toDate);

  // Debounce search — resets page in the same callback to avoid double-fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  // Fetch with abort controller to discard stale responses
  const fetchBookings = useCallback(async (silent = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (silent) setIsRefreshing(true);
    else        setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (search)     params.set("search",      search);
      if (calendarId) params.set("calendar_id", calendarId);
      if (status)     params.set("status",      status);
      if (fromDate)   params.set("from_date",   fromDate);
      if (toDate)     params.set("to_date",     toDate);
      params.set("limit",  String(PAGE_SIZE));
      params.set("offset", String(page * PAGE_SIZE));

      const res  = await fetch(`/api/appointments/bookings?${params}`, { signal: controller.signal });
      const json = await res.json() as { bookings?: BookingWithCalendar[]; total?: number; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Erro ao carregar");
      setBookings(json.bookings ?? []);
      setTotal(json.total ?? 0);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [search, calendarId, status, fromDate, toDate, page]);

  useEffect(() => { void fetchBookings(); }, [fetchBookings]);

  const handleStatusChange = (updated: BookingWithCalendar) => {
    setBookings(prev => prev.map(b => b.id === updated.id ? updated : b));
    setSelected(updated);
  };

  // Filter change helpers — reset page in the same call to avoid double-fetch
  const changeCalendarId = (v: string) => { setCalendarId(v); setPage(0); };
  const changeStatus     = (v: string) => { setStatus(v);     setPage(0); };
  const changeFromDate   = (v: string) => { setFromDate(v);   setPage(0); };
  const changeToDate     = (v: string) => { setToDate(v);     setPage(0); };

  const clearFilters = () => {
    setSearchInput("");
    setCalendarId("");
    setStatus("");
    setFromDate("");
    setToDate("");
    setPage(0);
  };

  const calendarCustomFields: AppointmentCustomField[] = selected
    ? (calendars.find(c => c.id === selected.calendar_id)?.custom_fields ?? [])
    : [];

  const pageStart = page * PAGE_SIZE + 1;
  const pageEnd   = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <div>
      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap gap-2 p-3 rounded-xl mb-3"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}
      >
        <div className="relative flex-1 min-w-[160px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--muted-foreground)" }} />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Nome, e-mail ou telefone..."
            className="w-full pl-8 pr-7 py-1.5 rounded-lg text-xs outline-none lc-filter-control"
          />
          {searchInput && (
            <button type="button" onClick={() => setSearchInput("")} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X size={10} style={{ color: "var(--muted-foreground)" }} />
            </button>
          )}
        </div>

        <select
          value={calendarId}
          onChange={e => changeCalendarId(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg text-xs outline-none lc-filter-control"
        >
          <option value="">Todos os calendários</option>
          {calendars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select
          value={status}
          onChange={e => changeStatus(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg text-xs outline-none lc-filter-control"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_CFG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <input
          type="date" value={fromDate} onChange={e => changeFromDate(e.target.value)}
          title="Data inicial"
          className="px-2.5 py-1.5 rounded-lg text-xs outline-none lc-filter-control min-w-[130px]"
        />
        <input
          type="date" value={toDate} onChange={e => changeToDate(e.target.value)}
          title="Data final"
          className="px-2.5 py-1.5 rounded-lg text-xs outline-none lc-filter-control min-w-[130px]"
        />

        {hasFilters && (
          <button
            type="button" onClick={clearFilters}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors"
            style={{ color: "var(--muted-foreground)", background: "rgba(255,255,255,0.04)" }}
          >
            <Filter size={11} />
            Limpar
          </button>
        )}

        <button
          type="button"
          onClick={() => void fetchBookings(true)}
          disabled={isRefreshing || isLoading}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-40"
          style={{ color: "var(--muted-foreground)", background: "rgba(255,255,255,0.04)" }}
          title="Atualizar"
        >
          <RefreshCw size={11} className={isRefreshing ? "animate-spin" : ""} />
        </button>
      </div>

      {/* ── Counter + top pagination ──────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          {isLoading ? (
            <Loader2 size={11} className="inline animate-spin mr-1.5" />
          ) : total > 0 ? (
            `${pageStart}–${pageEnd} de ${total} agendamento${total !== 1 ? "s" : ""}`
          ) : (
            "0 agendamentos"
          )}
        </p>

        {!isLoading && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(p - 1, 0))}
              disabled={page === 0}
              className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-white/5 transition-colors"
            >
              <ChevronLeft size={13} style={{ color: "var(--muted-foreground)" }} />
            </button>
            <span className="text-xs px-2" style={{ color: "var(--muted-foreground)" }}>
              {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(p + 1, totalPages - 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-white/5 transition-colors"
            >
              <ChevronRight size={13} style={{ color: "var(--muted-foreground)" }} />
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)" }}>
          {error}
        </p>
      )}

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-11 rounded-xl animate-pulse" style={{ background: "var(--card)", border: "1px solid var(--border)" }} />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Inbox size={32} className="mb-3 opacity-20" style={{ color: "var(--muted-foreground)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--text-title)" }}>
            Nenhum agendamento encontrado
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
            {hasFilters
              ? "Tente ajustar os filtros"
              : "Os agendamentos realizados na página pública aparecerão aqui"}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 text-xs font-medium underline"
              style={{ color: "var(--primary)" }}
            >
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div style={{ minWidth: "900px" }}>
            <div
              className="grid gap-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider mb-1"
              style={{ gridTemplateColumns: COL, color: "var(--muted-foreground)" }}
            >
              <span>Visitante</span>
              <span>E-mail</span>
              <span>Telefone</span>
              <span>Calendário</span>
              <span>Data</span>
              <span>Hora</span>
              <span>Status</span>
              <span>Criado em</span>
            </div>

            <div className="space-y-0.5">
              {bookings.map(booking => (
                <button
                  key={booking.id}
                  type="button"
                  onClick={() => setSelected(booking)}
                  className="w-full text-left grid gap-3 px-4 py-2.5 rounded-xl transition-all"
                  style={{ gridTemplateColumns: COL, border: "1px solid transparent" }}
                  onMouseOver={e => {
                    e.currentTarget.style.background  = "rgba(255,255,255,0.04)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.background  = "transparent";
                    e.currentTarget.style.borderColor = "transparent";
                  }}
                >
                  <span className="text-xs font-medium truncate" style={{ color: "var(--text-title)" }}>
                    {booking.visitor_name}
                  </span>
                  <span className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
                    {booking.visitor_email}
                  </span>
                  <span className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
                    {booking.visitor_phone || "—"}
                  </span>
                  <span className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
                    {booking.calendar_name}
                  </span>
                  <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    {fmtDate(booking.starts_at)}
                  </span>
                  <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    {fmtTime(booking.starts_at)}
                  </span>
                  <StatusBadge status={booking.status} />
                  <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    {fmtDate(booking.created_at)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom pagination ──────────────────────────────────────────────── */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <button
            type="button"
            onClick={() => setPage(0)}
            disabled={page === 0}
            className="px-2.5 py-1.5 rounded-lg text-xs disabled:opacity-30 transition-colors"
            style={{ color: "var(--muted-foreground)", background: "rgba(255,255,255,0.04)" }}
          >
            « Início
          </button>
          <button
            type="button"
            onClick={() => setPage(p => Math.max(p - 1, 0))}
            disabled={page === 0}
            className="px-2.5 py-1.5 rounded-lg text-xs disabled:opacity-30 transition-colors"
            style={{ color: "var(--muted-foreground)", background: "rgba(255,255,255,0.04)" }}
          >
            ‹ Anterior
          </button>
          <span className="text-xs px-3 py-1.5 rounded-lg" style={{ color: "var(--text-title)", background: "rgba(255,255,255,0.06)" }}>
            Pág. {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(p => Math.min(p + 1, totalPages - 1))}
            disabled={page >= totalPages - 1}
            className="px-2.5 py-1.5 rounded-lg text-xs disabled:opacity-30 transition-colors"
            style={{ color: "var(--muted-foreground)", background: "rgba(255,255,255,0.04)" }}
          >
            Próxima ›
          </button>
          <button
            type="button"
            onClick={() => setPage(totalPages - 1)}
            disabled={page >= totalPages - 1}
            className="px-2.5 py-1.5 rounded-lg text-xs disabled:opacity-30 transition-colors"
            style={{ color: "var(--muted-foreground)", background: "rgba(255,255,255,0.04)" }}
          >
            Final »
          </button>
        </div>
      )}

      {/* ── Drawer ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <BookingDrawer
            key={selected.id}
            booking={selected}
            calendarCustomFields={calendarCustomFields}
            onClose={() => setSelected(null)}
            onStatusChange={handleStatusChange}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
