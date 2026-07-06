"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import type {
  AppointmentAvailabilityRule,
  NewAppointmentAvailabilityRule,
} from "@/types/appointments";

const DAYS = [
  { index: 0, label: "Dom" },
  { index: 1, label: "Seg" },
  { index: 2, label: "Ter" },
  { index: 3, label: "Qua" },
  { index: 4, label: "Qui" },
  { index: 5, label: "Sex" },
  { index: 6, label: "Sáb" },
];

const DEFAULT_START = "09:00";
const DEFAULT_END   = "17:00";

interface DayState {
  day_of_week:  number;
  start_time:   string;
  end_time:     string;
  is_available: boolean;
}

function rulesTo7Days(rules: AppointmentAvailabilityRule[]): DayState[] {
  return DAYS.map(d => {
    const r = rules.find(r => r.day_of_week === d.index);
    return {
      day_of_week:  d.index,
      start_time:   r ? r.start_time.slice(0, 5) : DEFAULT_START,
      end_time:     r ? r.end_time.slice(0, 5)   : DEFAULT_END,
      is_available: r ? r.is_available : d.index !== 0 && d.index !== 6,
    };
  });
}

interface AvailabilityEditorProps {
  rules:      AppointmentAvailabilityRule[];
  isSaving:   boolean;
  onSave:     (rules: NewAppointmentAvailabilityRule[]) => void;
}

export function AvailabilityEditor({ rules, isSaving, onSave }: AvailabilityEditorProps) {
  const [days, setDays] = useState<DayState[]>(() => rulesTo7Days(rules));

  useEffect(() => { setDays(rulesTo7Days(rules)); }, [rules]);

  const toggle = (index: number) => {
    setDays(prev =>
      prev.map(d => d.day_of_week === index ? { ...d, is_available: !d.is_available } : d),
    );
  };

  const setTime = (index: number, field: "start_time" | "end_time", value: string) => {
    setDays(prev =>
      prev.map(d => d.day_of_week === index ? { ...d, [field]: value } : d),
    );
  };

  const handleSave = () => {
    const payload: NewAppointmentAvailabilityRule[] = days.map(d => ({
      day_of_week:  d.day_of_week,
      start_time:   d.start_time,
      end_time:     d.end_time,
      is_available: d.is_available,
    }));
    onSave(payload);
  };

  return (
    <div className="space-y-2">
      {days.map(day => {
        const label = DAYS.find(d => d.index === day.day_of_week)?.label ?? "";
        return (
          <div
            key={day.day_of_week}
            className="flex items-center gap-3 py-2"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            {/* Toggle */}
            <button
              onClick={() => toggle(day.day_of_week)}
              className="relative w-9 h-5 rounded-full transition-colors shrink-0"
              style={{
                background: day.is_available ? "var(--primary)" : "rgba(255,255,255,0.12)",
              }}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                style={{
                  left:      day.is_available ? "calc(100% - 18px)" : "2px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                }}
              />
            </button>

            {/* Day label */}
            <span
              className="text-sm w-8 shrink-0 font-medium"
              style={{ color: day.is_available ? "var(--text-title)" : "var(--muted-foreground)" }}
            >
              {label}
            </span>

            {/* Time inputs */}
            {day.is_available ? (
              <div className="flex items-center gap-2 text-sm">
                <input
                  type="time"
                  value={day.start_time}
                  onChange={e => setTime(day.day_of_week, "start_time", e.target.value)}
                  className="px-2 py-1 rounded-lg text-xs"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border:     "1px solid var(--border)",
                    color:      "var(--text-title)",
                  }}
                />
                <span style={{ color: "var(--muted-foreground)" }}>–</span>
                <input
                  type="time"
                  value={day.end_time}
                  onChange={e => setTime(day.day_of_week, "end_time", e.target.value)}
                  className="px-2 py-1 rounded-lg text-xs"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border:     "1px solid var(--border)",
                    color:      "var(--text-title)",
                  }}
                />
              </div>
            ) : (
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Indisponível
              </span>
            )}
          </div>
        );
      })}

      <div className="pt-3">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-50"
          style={{ background: "#b0b8c1", color: "#000000" }}
        >
          {isSaving && <Loader2 size={13} className="animate-spin" />}
          Salvar disponibilidade
        </button>
      </div>
    </div>
  );
}
