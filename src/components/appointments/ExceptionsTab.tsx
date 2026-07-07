"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import type {
  AppointmentAvailabilityException,
  NewAppointmentAvailabilityException,
} from "@/types/appointments";

const inputCls   = "px-2 py-1.5 rounded-lg text-sm outline-none";
const inputStyle = {
  background: "var(--input)",
  border:     "1px solid var(--border)",
  color:      "var(--text-title)",
};

interface ExceptionsTabProps {
  exceptions: AppointmentAvailabilityException[];
  onCreate:   (p: NewAppointmentAvailabilityException) => Promise<unknown>;
  onDelete:   (id: string) => void;
}

export function ExceptionsTab({ exceptions, onCreate, onDelete }: ExceptionsTabProps) {
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
    setDate(""); setReason(""); setType("blocked");
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
            style={{ background: "var(--hover)", border: "1px solid var(--border)" }}
          >
            <div>
              <span className="text-sm font-medium" style={{ color: "var(--text-title)" }}>
                {new Date(exc.exception_date + "T12:00:00Z").toLocaleDateString("pt-BR", {
                  day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
                })}
              </span>
              <span className="ml-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                {exc.type === "blocked"
                  ? "Bloqueado"
                  : `${exc.start_time?.slice(0, 5)} – ${exc.end_time?.slice(0, 5)}`}
              </span>
              {exc.reason && (
                <span className="ml-2 text-xs italic" style={{ color: "var(--muted-foreground)" }}>
                  · {exc.reason}
                </span>
              )}
            </div>
            <button
              onClick={() => onDelete(exc.id)}
              className="p-1.5 rounded-lg hover:bg-[var(--hover)] transition-colors"
            >
              <Trash2 size={13} style={{ color: "var(--muted-foreground)" }} />
            </button>
          </div>
        ))}
      </div>

      {showForm ? (
        <form onSubmit={handleAdd} className="space-y-3 p-4 rounded-xl" style={{ background: "var(--hover)", border: "1px solid var(--border)" }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Data</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
                className={`w-full ${inputCls}`}
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Tipo</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as "blocked" | "custom_hours")}
                className={`w-full ${inputCls}`}
                style={inputStyle}
              >
                <option value="blocked">Bloquear dia</option>
                <option value="custom_hours">Horário especial</option>
              </select>
            </div>
          </div>

          {type === "custom_hours" && (
            <div className="flex items-center gap-2 text-sm">
              <input
                type="time" value={start} onChange={e => setStart(e.target.value)}
                className={inputCls} style={inputStyle}
              />
              <span style={{ color: "var(--muted-foreground)" }}>–</span>
              <input
                type="time" value={end} onChange={e => setEnd(e.target.value)}
                className={inputCls} style={inputStyle}
              />
            </div>
          )}

          <div>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Motivo (opcional)"
              className={`w-full ${inputCls}`}
              style={inputStyle}
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
              style={{ background: "#b0b8c1", color: "#000000" }}
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
