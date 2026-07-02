"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  AppointmentCalendar,
  NewAppointmentCalendar,
  UpdateAppointmentCalendar,
} from "@/types/appointments";

export function useCalendars() {
  const [calendars, setCalendars] = useState<AppointmentCalendar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const mountedRef                = useRef(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/appointments/calendars");
      const json = await res.json() as { calendars?: AppointmentCalendar[]; error?: string };
      if (!mountedRef.current) return;
      if (!res.ok) throw new Error(json.error ?? "Erro ao carregar calendários");
      setCalendars(json.calendars ?? []);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refetch();
    return () => { mountedRef.current = false; };
  }, [refetch]);

  const createCalendar = useCallback(async (payload: NewAppointmentCalendar) => {
    const res  = await fetch("/api/appointments/calendars", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    const json = await res.json() as { calendar?: AppointmentCalendar; error?: string };
    if (!res.ok) {
      toast.error(json.error ?? "Erro ao criar calendário");
      return null;
    }
    toast.success("Calendário criado");
    await refetch();
    return json.calendar ?? null;
  }, [refetch]);

  const updateCalendar = useCallback(async (
    id:      string,
    payload: UpdateAppointmentCalendar,
  ) => {
    const res  = await fetch(`/api/appointments/calendars/${id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    const json = await res.json() as { calendar?: AppointmentCalendar; error?: string };
    if (!res.ok) {
      toast.error(json.error ?? "Erro ao atualizar calendário");
      return null;
    }
    toast.success("Calendário atualizado");
    if (mountedRef.current) {
      setCalendars(prev => prev.map(c => c.id === id ? (json.calendar ?? c) : c));
    }
    return json.calendar ?? null;
  }, []);

  const archiveCalendar = useCallback(async (id: string) => {
    // Optimistic remove
    setCalendars(prev => prev.filter(c => c.id !== id));

    const res  = await fetch(`/api/appointments/calendars/${id}`, { method: "DELETE" });
    const json = await res.json() as { ok?: boolean; error?: string };
    if (!res.ok) {
      toast.error(json.error ?? "Erro ao arquivar calendário");
      // Revert on failure
      if (mountedRef.current) await refetch();
      return false;
    }
    toast.success("Calendário arquivado");
    return true;
  }, [refetch]);

  return {
    calendars,
    isLoading,
    error,
    refetch,
    createCalendar,
    updateCalendar,
    archiveCalendar,
  };
}
