"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { PublicCalendar, AdminSlot } from "@/types/appointments";
import { getTodayInTz, addDaysToDateStr } from "@/lib/booking-widget/format";

// ─────────────────────────────────────────────────────────────────────────────
// useBookingWidget — estado/efeitos do widget de calendário+horários,
// extraído de BookingClient.tsx (página pública /agendar/[slug]) para ser
// reutilizado também pelo bloco Calendário do construtor de Formulários.
//
// A escolha de data mostra os próximos DAYS_VISIBLE dias disponíveis a partir
// de hoje (sem navegação por mês) — todos visíveis de uma vez, junto com os
// horários, num único quadrante (layout aprovado para as duas superfícies).
//
// Não inclui o formulário de dados do visitante nem a criação do booking —
// isso continua específico de cada consumidor (rotas/telas diferentes).
// ─────────────────────────────────────────────────────────────────────────────

const DAYS_VISIBLE = 5;
// Teto de dias varridos à procura dos DAYS_VISIBLE disponíveis — evita loop
// longo em calendários com janela de reserva grande e poucos dias úteis.
const SCAN_CAP_DAYS = 60;

export function useBookingWidget(slug: string | null | undefined) {
  const [calendar,          setCalendar]          = useState<PublicCalendar | null>(null);
  const [availableWeekdays, setAvailableWeekdays] = useState<number[]>([]);
  const [isLoading,         setIsLoading]         = useState(true);
  const [loadError,         setLoadError]         = useState<string | null>(null);

  const [selectedDate,    setSelectedDate]    = useState<string | null>(null);
  const [slots,           setSlots]           = useState<AdminSlot[]>([]);
  const [isFetchingSlots, setIsFetchingSlots] = useState(false);

  useEffect(() => {
    if (!slug) { setIsLoading(false); return; }
    setIsLoading(true);
    setLoadError(null);
    fetch(`/api/agendar/${slug}`, { cache: "no-store" })
      .then(r => r.json())
      .then((data: { calendar?: PublicCalendar; available_weekdays?: number[]; error?: string }) => {
        if (data.error || !data.calendar) {
          setLoadError(data.error ?? "Calendário não encontrado");
        } else {
          setCalendar(data.calendar);
          setAvailableWeekdays(data.available_weekdays ?? []);
        }
      })
      .catch(() => setLoadError("Erro ao carregar o calendário"))
      .finally(() => setIsLoading(false));
  }, [slug]);

  const today   = calendar ? getTodayInTz(calendar.timezone) : new Date().toLocaleDateString("sv-SE");
  const maxDate = useMemo(() => {
    if (!calendar) return today;
    return addDaysToDateStr(today, calendar.booking_window_days);
  }, [calendar, today]);

  const isDayAvailable = useCallback((dateStr: string): boolean => {
    if (dateStr < today || dateStr > maxDate) return false;
    const dow = new Date(dateStr + "T12:00:00").getDay();
    return availableWeekdays.includes(dow);
  }, [today, maxDate, availableWeekdays]);

  // Próximos DAYS_VISIBLE dias disponíveis a partir de hoje — sem navegação.
  const visibleDays = useMemo(() => {
    if (!calendar) return [];
    const days: string[] = [];
    for (let i = 0; i <= SCAN_CAP_DAYS && days.length < DAYS_VISIBLE; i++) {
      const candidate = addDaysToDateStr(today, i);
      if (isDayAvailable(candidate)) days.push(candidate);
    }
    return days;
  }, [calendar, today, isDayAvailable]);

  const fetchSlots = useCallback(async (dateStr: string) => {
    setSlots([]);
    setIsFetchingSlots(true);
    try {
      const res  = await fetch(`/api/agendar/${slug}/slots?date=${dateStr}`, { cache: "no-store" });
      const data = await res.json() as { slots?: AdminSlot[]; error?: string };
      setSlots(data.slots ?? []);
    } catch {
      setSlots([]);
    } finally {
      setIsFetchingSlots(false);
    }
  }, [slug]);

  const selectDate = useCallback(async (dateStr: string) => {
    if (!isDayAvailable(dateStr)) return;
    setSelectedDate(dateStr);
    await fetchSlots(dateStr);
  }, [isDayAvailable, fetchSlots]);

  // Seleciona o primeiro dia visível automaticamente — evita um clique extra
  // e deixa os horários já visíveis assim que o widget carrega.
  useEffect(() => {
    if (selectedDate || visibleDays.length === 0) return;
    void selectDate(visibleDays[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleDays]);

  const clearSelectedDate = useCallback(() => {
    setSelectedDate(null);
    setSlots([]);
  }, []);

  return {
    calendar, isLoading, loadError,
    visibleDays, today, isDayAvailable,
    selectedDate, selectDate, clearSelectedDate,
    slots, isFetchingSlots, fetchSlots,
  };
}
