"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import type { NewAppointmentCalendar } from "@/types/appointments";

const TIMEZONES = [
  { value: "America/Sao_Paulo",  label: "Brasília (BRT)" },
  { value: "America/Manaus",     label: "Manaus (AMT)" },
  { value: "America/Belem",      label: "Belém (BRT)" },
  { value: "America/Fortaleza",  label: "Fortaleza (BRT)" },
  { value: "America/Recife",     label: "Recife (BRT)" },
  { value: "America/Maceio",     label: "Maceió (BRT)" },
  { value: "America/Bahia",      label: "Salvador (BRT)" },
  { value: "America/Cuiaba",     label: "Cuiabá (AMT)" },
  { value: "America/Porto_Velho", label: "Porto Velho (AMT)" },
  { value: "America/Boa_Vista",  label: "Boa Vista (AMT)" },
  { value: "America/Rio_Branco", label: "Rio Branco (ACT)" },
  { value: "America/Noronha",    label: "Fernando de Noronha (FNT)" },
  { value: "UTC",                label: "UTC" },
];

interface CreateCalendarModalProps {
  onClose:  () => void;
  onCreate: (payload: NewAppointmentCalendar) => Promise<NewAppointmentCalendar | null>;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function CreateCalendarModal({ onClose, onCreate }: CreateCalendarModalProps) {
  const [name,            setName]            = useState("");
  const [description,     setDescription]     = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [timezone,        setTimezone]        = useState("America/Sao_Paulo");
  const [isSaving,        setIsSaving]        = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    const payload: NewAppointmentCalendar = {
      name:                  name.trim(),
      slug:                  slugify(name.trim()),
      description:           description.trim() || null,
      duration_minutes:      durationMinutes,
      location_type:         null,
      location:              null,
      meeting_provider:      "none",
      custom_meeting_url:    null,
      timezone,
      booking_window_days:   60,
      min_notice_hours:      1,
      capacity_per_slot:     1,
      buffer_before_minutes: 0,
      buffer_after_minutes:  0,
      daily_limit:           null,
      status:                "active",
      custom_fields:         [],
      settings:              {},
    };
    const result = await onCreate(payload);
    setIsSaving(false);
    if (result) onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 lc-scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
        onClick={onClose}
      >
        <motion.div
          className="w-full max-w-md lc-modal-panel p-6"
          initial={{ scale: 0.95, opacity: 0, y: 12 }}
          animate={{ scale: 1,    opacity: 1, y: 0 }}
          exit={{ scale: 0.95,    opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-base" style={{ color: "var(--text-title)" }}>
              Novo calendário
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[var(--hover)] transition-colors"
            >
              <X size={16} style={{ color: "var(--muted-foreground)" }} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: "var(--muted-foreground)" }}>
                Nome *
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Reunião de Onboarding"
                required
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{
                  background: "var(--input)",
                  border:     "1px solid var(--border)",
                  color:      "var(--text-title)",
                }}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: "var(--muted-foreground)" }}>
                Descrição
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Breve descrição exibida para o visitante"
                rows={2}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                style={{
                  background: "var(--input)",
                  border:     "1px solid var(--border)",
                  color:      "var(--text-title)",
                }}
              />
            </div>

            {/* Duration + Timezone */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: "var(--muted-foreground)" }}>
                  Duração (min)
                </label>
                <select
                  value={durationMinutes}
                  onChange={e => setDurationMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{
                    background: "var(--input)",
                    border:     "1px solid var(--border)",
                    color:      "var(--text-title)",
                  }}
                >
                  {[15, 20, 30, 45, 60, 90, 120].map(v => (
                    <option key={v} value={v}>{v} min</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: "var(--muted-foreground)" }}>
                  Fuso horário
                </label>
                <select
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{
                    background: "var(--input)",
                    border:     "1px solid var(--border)",
                    color:      "var(--text-title)",
                  }}
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm transition-colors hover:bg-[var(--hover)]"
                style={{ color: "var(--muted-foreground)" }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving || !name.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-50"
                style={{ background: "#b0b8c1", color: "#000000" }}
              >
                {isSaving && <Loader2 size={13} className="animate-spin" />}
                Criar calendário
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
