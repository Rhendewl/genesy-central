"use client";

import { use, useState } from "react";
import { useRouter }     from "next/navigation";
import { motion }        from "framer-motion";
import {
  ArrowLeft, Clock, Globe, Settings, CalendarDays,
  Loader2, CalendarX, Plus, Trash2,
} from "lucide-react";
import { Header }              from "@/components/layout/Header";
import { AvailabilityEditor }  from "@/components/appointments/AvailabilityEditor";
import { useCalendar }         from "@/hooks/useCalendar";
import type { AdminSlot } from "@/types/appointments";

// ── Tab types ──────────────────────────────────────────────────────────────────

type Tab = "disponibilidade" | "excecoes" | "horarios";

export default function CalendarDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id }   = use(params);
  const router   = useRouter();
  const [tab, setTab] = useState<Tab>("disponibilidade");
  const [isSavingRules, setIsSavingRules] = useState(false);

  const {
    calendar, rules, exceptions,
    isLoading, error,
    upsertRules, createException, deleteException, getSlots,
  } = useCalendar(id);

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Calendário" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />
        </div>
      </div>
    );
  }

  if (error || !calendar) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Calendário" />
        <div className="flex-1 flex items-center justify-center flex-col gap-3">
          <CalendarX size={32} style={{ color: "var(--muted-foreground)" }} />
          <p style={{ color: "var(--muted-foreground)" }}>{error ?? "Calendário não encontrado"}</p>
          <button
            onClick={() => router.push("/agendamentos")}
            className="text-sm underline"
            style={{ color: "var(--muted-foreground)" }}
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const handleSaveRules = async (newRules: Parameters<typeof upsertRules>[0]) => {
    setIsSavingRules(true);
    await upsertRules(newRules);
    setIsSavingRules(false);
  };

  return (
    <div className="flex flex-col min-h-screen pb-24">
      {/* Back nav */}
      <div className="px-4 sm:px-6 pt-4 pb-0">
        <button
          onClick={() => router.push("/agendamentos")}
          className="flex items-center gap-1.5 text-sm mb-4 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted-foreground)" }}
        >
          <ArrowLeft size={14} />
          Agendamentos
        </button>
      </div>

      <Header
        title={calendar.name}
        subtitle={calendar.description ?? undefined}
      />

      {/* Calendar meta */}
      <div className="px-4 sm:px-6 pb-4">
        <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {calendar.duration_minutes} min
          </span>
          <span className="flex items-center gap-1">
            <Globe size={12} />
            {calendar.timezone}
          </span>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{
              background: calendar.status === "active" ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.08)",
              color:      calendar.status === "active" ? "#22c55e" : "rgba(255,255,255,0.35)",
            }}
          >
            {calendar.status === "active" ? "Ativo" : "Arquivado"}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="px-4 sm:px-6 flex gap-1 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        {(["disponibilidade", "excecoes", "horarios"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-3 py-2 text-sm font-medium transition-colors relative"
            style={{
              color: tab === t ? "var(--text-title)" : "var(--muted-foreground)",
            }}
          >
            {t === "disponibilidade" && "Disponibilidade"}
            {t === "excecoes"        && "Exceções"}
            {t === "horarios"        && "Prévia de horários"}
            {tab === t && (
              <motion.span
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                style={{ background: "var(--primary)" }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-4 sm:px-6 pt-5">
        {tab === "disponibilidade" && (
          <div className="max-w-lg">
            <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>
              Configure os dias e horários em que seu calendário aceita agendamentos.
            </p>
            <AvailabilityEditor
              rules={rules}
              isSaving={isSavingRules}
              onSave={handleSaveRules}
            />
          </div>
        )}

        {tab === "excecoes" && (
          <ExceptionsTab
            exceptions={exceptions}
            onCreate={createException}
            onDelete={deleteException}
          />
        )}

        {tab === "horarios" && (
          <SlotPreviewTab
            calendarId={calendar.id}
            timezone={calendar.timezone}
            getSlots={getSlots}
          />
        )}
      </div>
    </div>
  );
}

// ── Exceptions tab ────────────────────────────────────────────────────────────

import type {
  AppointmentAvailabilityException,
  NewAppointmentAvailabilityException,
} from "@/types/appointments";

function ExceptionsTab({
  exceptions,
  onCreate,
  onDelete,
}: {
  exceptions: AppointmentAvailabilityException[];
  onCreate:   (p: NewAppointmentAvailabilityException) => Promise<unknown>;
  onDelete:   (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [date,     setDate]     = useState("");
  const [type,     setType]     = useState<"blocked" | "custom_hours">("blocked");
  const [start,    setStart]    = useState("09:00");
  const [end,      setEnd]      = useState("17:00");
  const [reason,   setReason]   = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;
    setIsSaving(true);
    await onCreate({
      exception_date: date,
      type,
      start_time: type === "custom_hours" ? start : null,
      end_time:   type === "custom_hours" ? end   : null,
      reason:     reason.trim() || null,
    });
    setIsSaving(false);
    setShowForm(false);
    setDate(""); setReason("");
  };

  return (
    <div className="max-w-lg">
      <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>
        Bloqueie datas específicas ou defina horários especiais que sobrepõem a agenda semanal.
      </p>

      <div className="space-y-2 mb-4">
        {exceptions.length === 0 && !showForm && (
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Nenhuma exceção cadastrada.
          </p>
        )}
        {exceptions.map(exc => (
          <div
            key={exc.id}
            className="flex items-center justify-between px-3 py-2 rounded-xl"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}
          >
            <div>
              <span className="text-sm font-medium" style={{ color: "var(--text-title)" }}>
                {exc.exception_date}
              </span>
              <span className="ml-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                {exc.type === "blocked"
                  ? "Bloqueado"
                  : `${exc.start_time?.slice(0,5)} – ${exc.end_time?.slice(0,5)}`}
              </span>
              {exc.reason && (
                <span className="ml-2 text-xs italic" style={{ color: "var(--muted-foreground)" }}>
                  · {exc.reason}
                </span>
              )}
            </div>
            <button
              onClick={() => onDelete(exc.id)}
              className="p-1 rounded hover:bg-white/10 transition-colors"
            >
              <Trash2 size={13} style={{ color: "var(--muted-foreground)" }} />
            </button>
          </div>
        ))}
      </div>

      {showForm ? (
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Data</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
                className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--text-title)" }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Tipo</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as "blocked" | "custom_hours")}
                className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--text-title)" }}
              >
                <option value="blocked">Bloquear</option>
                <option value="custom_hours">Horário especial</option>
              </select>
            </div>
          </div>

          {type === "custom_hours" && (
            <div className="flex items-center gap-2 text-sm">
              <input
                type="time" value={start} onChange={e => setStart(e.target.value)}
                className="px-2 py-1.5 rounded-lg text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--text-title)" }}
              />
              <span style={{ color: "var(--muted-foreground)" }}>–</span>
              <input
                type="time" value={end} onChange={e => setEnd(e.target.value)}
                className="px-2 py-1.5 rounded-lg text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--text-title)" }}
              />
            </div>
          )}

          <div>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Motivo (opcional)"
              className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--text-title)" }}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{ color: "var(--muted-foreground)" }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving || !date}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--primary)", color: "#fff" }}
            >
              {isSaving && <Loader2 size={12} className="animate-spin" />}
              Adicionar
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
          style={{ color: "var(--primary)" }}
        >
          <Plus size={14} />
          Adicionar exceção
        </button>
      )}
    </div>
  );
}

// ── Slot preview tab ──────────────────────────────────────────────────────────

function SlotPreviewTab({
  calendarId,
  timezone,
  getSlots,
}: {
  calendarId: string;
  timezone:   string;
  getSlots:   (dateStr: string) => Promise<AdminSlot[]>;
}) {
  const [dateStr, setDateStr] = useState(
    new Date().toLocaleDateString("sv-SE"),
  );
  const [slots,     setSlots]     = useState<AdminSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loaded,    setLoaded]    = useState(false);

  const handlePreview = async () => {
    setIsLoading(true);
    const result = await getSlots(dateStr);
    setSlots(result);
    setLoaded(true);
    setIsLoading(false);
  };

  return (
    <div className="max-w-sm">
      <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>
        Visualize os horários disponíveis para uma data específica.
        Fuso: <strong>{timezone}</strong>
      </p>

      <div className="flex items-center gap-2 mb-4">
        <input
          type="date"
          value={dateStr}
          onChange={e => { setDateStr(e.target.value); setLoaded(false); }}
          className="px-2 py-1.5 rounded-lg text-sm outline-none"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--text-title)" }}
        />
        <button
          onClick={handlePreview}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--primary)", color: "#fff" }}
        >
          {isLoading
            ? <Loader2 size={13} className="animate-spin" />
            : <CalendarDays size={13} />}
          Ver horários
        </button>
      </div>

      {loaded && (
        <div>
          {slots.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Nenhum horário disponível para esta data.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.map(slot => (
                <span
                  key={slot.startsAt}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--text-title)" }}
                >
                  {slot.startsAtLocal}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
