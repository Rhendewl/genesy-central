"use client";

import { useState, useEffect } from "react";
import {
  Plus, Trash2, Loader2, CalendarDays, Copy,
} from "lucide-react";
import type {
  AppointmentAvailabilityRule,
  NewAppointmentAvailabilityRule,
  AdminSlot,
} from "@/types/appointments";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TimeInterval {
  start_time: string; // "HH:MM"
  end_time:   string; // "HH:MM"
}

type ScheduleState = Record<number, TimeInterval[]>; // day_of_week → intervals

const DAYS = [
  { index: 1, label: "Segunda" },
  { index: 2, label: "Terça" },
  { index: 3, label: "Quarta" },
  { index: 4, label: "Quinta" },
  { index: 5, label: "Sexta" },
  { index: 6, label: "Sábado" },
  { index: 0, label: "Domingo" },
];

const DEFAULT_START = "09:00";
const DEFAULT_END   = "17:00";

// ── Converters ────────────────────────────────────────────────────────────────

function rulesToSchedule(rules: AppointmentAvailabilityRule[]): ScheduleState {
  const state: ScheduleState = {};
  for (let d = 0; d <= 6; d++) state[d] = [];

  for (const r of rules) {
    if (r.is_available) {
      state[r.day_of_week] = [
        ...(state[r.day_of_week] ?? []),
        {
          start_time: r.start_time.slice(0, 5),
          end_time:   r.end_time.slice(0, 5),
        },
      ];
    }
  }

  for (let d = 0; d <= 6; d++) {
    state[d].sort((a, b) => a.start_time.localeCompare(b.start_time));
  }
  return state;
}

function scheduleToRules(state: ScheduleState): NewAppointmentAvailabilityRule[] {
  const rules: NewAppointmentAvailabilityRule[] = [];
  for (let d = 0; d <= 6; d++) {
    for (const iv of state[d] ?? []) {
      rules.push({ day_of_week: d, start_time: iv.start_time, end_time: iv.end_time, is_available: true });
    }
  }
  return rules;
}

function hasOverlap(intervals: TimeInterval[]): boolean {
  const sorted = [...intervals].sort((a, b) => a.start_time.localeCompare(b.start_time));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start_time < sorted[i - 1].end_time) return true;
  }
  return false;
}

function hasError(intervals: TimeInterval[]): boolean {
  if (intervals.some(iv => !iv.start_time || !iv.end_time || iv.start_time >= iv.end_time)) return true;
  return hasOverlap(intervals);
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputCls   = "px-2 py-1.5 rounded-lg text-xs outline-none w-24";
const inputStyle = {
  background: "rgba(255,255,255,0.06)",
  border:     "1px solid var(--border)",
  color:      "var(--text-title)",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function IntervalRow({
  iv, onChange, onRemove, showRemove,
}: {
  iv:         TimeInterval;
  onChange:   (next: TimeInterval) => void;
  onRemove:   () => void;
  showRemove: boolean;
}) {
  const invalid = !iv.start_time || !iv.end_time || iv.start_time >= iv.end_time;
  return (
    <div className="flex items-center gap-2">
      <input
        type="time"
        value={iv.start_time}
        onChange={e => onChange({ ...iv, start_time: e.target.value })}
        className={inputCls}
        style={{ ...inputStyle, borderColor: invalid ? "rgba(239,68,68,0.5)" : undefined }}
      />
      <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>–</span>
      <input
        type="time"
        value={iv.end_time}
        onChange={e => onChange({ ...iv, end_time: e.target.value })}
        className={inputCls}
        style={{ ...inputStyle, borderColor: invalid ? "rgba(239,68,68,0.5)" : undefined }}
      />
      {showRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="p-1 rounded hover:bg-white/10 transition-colors"
        >
          <Trash2 size={12} style={{ color: "var(--muted-foreground)" }} />
        </button>
      )}
    </div>
  );
}

// ── SlotPreview ───────────────────────────────────────────────────────────────

function SlotPreview({
  calendarId, timezone, getSlots,
}: {
  calendarId: string;
  timezone:   string;
  getSlots:   (dateStr: string) => Promise<AdminSlot[]>;
}) {
  const [dateStr,   setDateStr]   = useState(new Date().toLocaleDateString("sv-SE"));
  const [slots,     setSlots]     = useState<AdminSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loaded,    setLoaded]    = useState(false);

  const preview = async () => {
    setIsLoading(true);
    setSlots(await getSlots(dateStr));
    setLoaded(true);
    setIsLoading(false);
  };

  return (
    <div className="max-w-sm pt-6 border-t" style={{ borderColor: "var(--border)" }}>
      <p className="text-xs font-semibold mb-3" style={{ color: "var(--muted-foreground)" }}>
        Prévia de horários
      </p>
      <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>
        Fuso: <strong style={{ color: "var(--text-title)" }}>{timezone}</strong>
      </p>
      <div className="flex items-center gap-2 mb-3">
        <input
          type="date"
          value={dateStr}
          onChange={e => { setDateStr(e.target.value); setLoaded(false); }}
          className="px-2 py-1.5 rounded-lg text-sm outline-none"
          style={inputStyle}
        />
        <button
          type="button"
          onClick={preview}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--primary)", color: "#fff" }}
        >
          {isLoading ? <Loader2 size={13} className="animate-spin" /> : <CalendarDays size={13} />}
          Ver horários
        </button>
      </div>
      {loaded && (
        slots.length === 0
          ? <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Nenhum horário disponível.</p>
          : (
            <div className="flex flex-wrap gap-2">
              {slots.map(s => (
                <span
                  key={s.startsAt}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--text-title)" }}
                >
                  {s.startsAtLocal}
                </span>
              ))}
            </div>
          )
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface HorariosTabProps {
  rules:      AppointmentAvailabilityRule[];
  isSaving:   boolean;
  calendarId: string;
  timezone:   string;
  onSave:     (rules: NewAppointmentAvailabilityRule[]) => void;
  getSlots:   (dateStr: string) => Promise<AdminSlot[]>;
}

export function HorariosTab({
  rules, isSaving, calendarId, timezone, onSave, getSlots,
}: HorariosTabProps) {
  const [schedule, setSchedule] = useState<ScheduleState>(() => rulesToSchedule(rules));
  const [copyMsg,  setCopyMsg]  = useState<number | null>(null);

  useEffect(() => { setSchedule(rulesToSchedule(rules)); }, [rules]);

  const isEnabled = (day: number) => (schedule[day]?.length ?? 0) > 0;

  const toggle = (day: number) => {
    setSchedule(prev => ({
      ...prev,
      [day]: isEnabled(day)
        ? []
        : [{ start_time: DEFAULT_START, end_time: DEFAULT_END }],
    }));
  };

  const addInterval = (day: number) => {
    setSchedule(prev => {
      const last    = prev[day]?.[prev[day].length - 1];
      const newStart = last?.end_time ?? DEFAULT_START;
      const newEnd   = newStart < "16:00" ? (() => {
        const [h, m] = newStart.split(":").map(Number);
        const endH   = Math.min(h + 1, 23);
        return `${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      })() : DEFAULT_END;
      return { ...prev, [day]: [...(prev[day] ?? []), { start_time: newStart, end_time: newEnd }] };
    });
  };

  const updateInterval = (day: number, idx: number, next: TimeInterval) => {
    setSchedule(prev => {
      const updated = [...prev[day]];
      updated[idx] = next;
      return { ...prev, [day]: updated };
    });
  };

  const removeInterval = (day: number, idx: number) => {
    setSchedule(prev => {
      const updated = prev[day].filter((_, i) => i !== idx);
      return { ...prev, [day]: updated };
    });
  };

  const copyToAll = (sourceDay: number) => {
    const intervals = schedule[sourceDay] ?? [];
    setSchedule(prev => {
      const next = { ...prev };
      for (let d = 0; d <= 6; d++) {
        if (d !== sourceDay) next[d] = intervals.map(iv => ({ ...iv }));
      }
      return next;
    });
    setCopyMsg(sourceDay);
    setTimeout(() => setCopyMsg(null), 2000);
  };

  const hasAnyError = DAYS.some(d => {
    const ivs = schedule[d.index];
    return ivs.length > 0 && hasError(ivs);
  });

  const handleSave = () => {
    if (hasAnyError) return;
    onSave(scheduleToRules(schedule));
  };

  return (
    <div className="space-y-1 max-w-lg">
      <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>
        Configure os horários disponíveis por dia. Cada dia pode ter múltiplos intervalos.
      </p>

      {DAYS.map(({ index, label }) => {
        const intervals = schedule[index] ?? [];
        const enabled   = intervals.length > 0;
        const error     = enabled && hasError(intervals);
        const overlap   = enabled && intervals.length > 1 && hasOverlap(intervals);

        return (
          <div
            key={index}
            className="rounded-xl px-4 py-3"
            style={{
              background:   enabled ? "rgba(255,255,255,0.03)" : "transparent",
              border:       `1px solid ${error ? "rgba(239,68,68,0.3)" : "var(--border)"}`,
              borderRadius: "12px",
            }}
          >
            {/* Day header */}
            <div className="flex items-center gap-3 mb-0">
              {/* Toggle */}
              <button
                type="button"
                onClick={() => toggle(index)}
                className="relative w-9 h-5 rounded-full transition-colors shrink-0"
                style={{ background: enabled ? "var(--primary)" : "rgba(255,255,255,0.12)" }}
              >
                <span
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                  style={{
                    left:      enabled ? "calc(100% - 18px)" : "2px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  }}
                />
              </button>

              <span
                className="text-sm font-medium w-16 shrink-0"
                style={{ color: enabled ? "var(--text-title)" : "var(--muted-foreground)" }}
              >
                {label}
              </span>

              {!enabled && (
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  Indisponível
                </span>
              )}

              {enabled && (
                <div className="flex-1 flex flex-col gap-2">
                  {intervals.map((iv, i) => (
                    <IntervalRow
                      key={i}
                      iv={iv}
                      onChange={next => updateInterval(index, i, next)}
                      onRemove={() => removeInterval(index, i)}
                      showRemove={intervals.length > 1}
                    />
                  ))}

                  <div className="flex items-center gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => addInterval(index)}
                      className="flex items-center gap-1 text-xs transition-opacity hover:opacity-70"
                      style={{ color: "var(--primary)" }}
                    >
                      <Plus size={11} />
                      Adicionar intervalo
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToAll(index)}
                      className="flex items-center gap-1 text-xs transition-opacity hover:opacity-70"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      <Copy size={11} />
                      {copyMsg === index ? "Copiado!" : "Copiar para todos"}
                    </button>
                  </div>

                  {overlap && (
                    <p className="text-xs" style={{ color: "#ef4444" }}>
                      Intervalos se sobrepõem — corrija antes de salvar
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div className="pt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || hasAnyError}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-50"
          style={{ background: "var(--primary)", color: "#fff" }}
        >
          {isSaving && <Loader2 size={13} className="animate-spin" />}
          Salvar horários
        </button>
      </div>

      <SlotPreview calendarId={calendarId} timezone={timezone} getSlots={getSlots} />
    </div>
  );
}
