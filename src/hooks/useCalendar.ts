"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  AppointmentCalendar,
  AppointmentAvailabilityRule,
  AppointmentAvailabilityException,
  NewAppointmentAvailabilityRule,
  NewAppointmentAvailabilityException,
  AdminSlot,
} from "@/types/appointments";

export function useCalendar(calendarId: string) {
  const [calendar,   setCalendar]   = useState<AppointmentCalendar | null>(null);
  const [rules,      setRules]      = useState<AppointmentAvailabilityRule[]>([]);
  const [exceptions, setExceptions] = useState<AppointmentAvailabilityException[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const mountedRef                  = useRef(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [calRes, rulesRes, excRes] = await Promise.all([
        fetch(`/api/appointments/calendars/${calendarId}`),
        fetch(`/api/appointments/calendars/${calendarId}/availability`),
        fetch(`/api/appointments/calendars/${calendarId}/exceptions`),
      ]);

      const [calJson, rulesJson, excJson] = await Promise.all([
        calRes.json()   as Promise<{ calendar?:    AppointmentCalendar;                error?: string }>,
        rulesRes.json() as Promise<{ rules?:       AppointmentAvailabilityRule[];      error?: string }>,
        excRes.json()   as Promise<{ exceptions?:  AppointmentAvailabilityException[]; error?: string }>,
      ]);

      if (!mountedRef.current) return;

      if (!calRes.ok)   throw new Error(calJson.error   ?? "Erro ao carregar calendário");
      if (!rulesRes.ok) throw new Error(rulesJson.error ?? "Erro ao carregar disponibilidade");
      if (!excRes.ok)   throw new Error(excJson.error   ?? "Erro ao carregar exceções");

      setCalendar(calJson.calendar       ?? null);
      setRules(rulesJson.rules           ?? []);
      setExceptions(excJson.exceptions   ?? []);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [calendarId]);

  useEffect(() => {
    mountedRef.current = true;
    refetch();
    return () => { mountedRef.current = false; };
  }, [refetch]);

  // ── Availability rules ─────────────────────────────────────────────────────

  const upsertRules = useCallback(async (newRules: NewAppointmentAvailabilityRule[]) => {
    const res  = await fetch(`/api/appointments/calendars/${calendarId}/availability`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ rules: newRules }),
    });
    const json = await res.json() as { rules?: AppointmentAvailabilityRule[]; error?: string };
    if (!res.ok) {
      toast.error(json.error ?? "Erro ao salvar disponibilidade");
      return false;
    }
    toast.success("Disponibilidade salva");
    if (mountedRef.current) setRules(json.rules ?? []);
    return true;
  }, [calendarId]);

  // ── Availability exceptions ────────────────────────────────────────────────

  const createException = useCallback(async (payload: NewAppointmentAvailabilityException) => {
    const res  = await fetch(`/api/appointments/calendars/${calendarId}/exceptions`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    const json = await res.json() as { exception?: AppointmentAvailabilityException; error?: string };
    if (!res.ok) {
      toast.error(json.error ?? "Erro ao criar exceção");
      return null;
    }
    toast.success("Exceção adicionada");
    if (mountedRef.current && json.exception) {
      setExceptions(prev =>
        [...prev, json.exception!].sort(
          (a, b) => a.exception_date.localeCompare(b.exception_date),
        ),
      );
    }
    return json.exception ?? null;
  }, [calendarId]);

  const deleteException = useCallback(async (exId: string) => {
    // Optimistic remove
    setExceptions(prev => prev.filter(e => e.id !== exId));

    const res  = await fetch(
      `/api/appointments/calendars/${calendarId}/exceptions/${exId}`,
      { method: "DELETE" },
    );
    const json = await res.json() as { ok?: boolean; error?: string };
    if (!res.ok) {
      toast.error(json.error ?? "Erro ao remover exceção");
      if (mountedRef.current) await refetch();
      return false;
    }
    toast.success("Exceção removida");
    return true;
  }, [calendarId, refetch]);

  // ── Slot preview ──────────────────────────────────────────────────────────

  const getSlots = useCallback(async (dateStr: string): Promise<AdminSlot[]> => {
    const res  = await fetch(
      `/api/appointments/calendars/${calendarId}/slots?date=${dateStr}`,
    );
    const json = await res.json() as { slots?: AdminSlot[]; error?: string };
    if (!res.ok) {
      toast.error(json.error ?? "Erro ao carregar horários");
      return [];
    }
    return json.slots ?? [];
  }, [calendarId]);

  return {
    calendar,
    rules,
    exceptions,
    isLoading,
    error,
    refetch,
    upsertRules,
    createException,
    deleteException,
    getSlots,
  };
}
