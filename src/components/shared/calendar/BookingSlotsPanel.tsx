"use client";

import { Calendar } from "lucide-react";
import type { AdminSlot } from "@/types/appointments";

// ─────────────────────────────────────────────────────────────────────────────
// Painel de horários do widget de agendamento — extraído de BookingClient.tsx
// (SlotsPanel inline) para ser reutilizado também pelo bloco Calendário do
// construtor de Formulários. Cores vêm de fora (mesmo motivo do
// BookingDayStrip — cada consumidor segue seu próprio tema).
// ─────────────────────────────────────────────────────────────────────────────

export interface BookingSlotsPanelProps {
  selectedDate:    string | null;
  selectedSlot?:   AdminSlot | null;
  isFetchingSlots: boolean;
  slots:           AdminSlot[];
  color:           string;
  cardBg:          string;
  borderC:         string;
  textColor:       string;
  muted:           string;
  onSelectSlot:    (slot: AdminSlot) => void;
}

export function BookingSlotsPanel({
  selectedDate, selectedSlot, isFetchingSlots, slots, color, cardBg, borderC, textColor, muted, onSelectSlot,
}: BookingSlotsPanelProps) {
  if (isFetchingSlots) {
    return (
      <div className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: cardBg }} />
        ))}
      </div>
    );
  }

  if (!selectedDate) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Calendar size={22} className="mb-2" style={{ color: muted }} />
        <p className="text-xs" style={{ color: muted }}>Selecione uma data</p>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="text-center py-6">
        <Calendar size={22} className="mx-auto mb-2" style={{ color: muted }} />
        <p className="text-xs" style={{ color: muted }}>Nenhum horário disponível neste dia</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {slots.map(slot => {
        const selected = selectedSlot?.startsAt === slot.startsAt;
        return (
          <button
            key={slot.startsAt}
            type="button"
            onClick={() => onSelectSlot(slot)}
            className="py-2.5 text-sm font-semibold rounded-xl border transition-all text-center"
            style={selected
              ? { background: `${color}18`, borderColor: color, color }
              : { background: cardBg, borderColor: borderC, color: textColor }}
          >
            {slot.startsAtLocal}
          </button>
        );
      })}
    </div>
  );
}
