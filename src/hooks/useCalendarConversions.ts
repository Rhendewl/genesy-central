"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { AppointmentConversion, NewAppointmentConversion, UpdateAppointmentConversion } from "@/types/appointments";
import type { CrmConversionSource } from "@/types/crm";

export function useCalendarConversions(calendarId: string | null) {
  const [conversions, setConversions] = useState<AppointmentConversion[]>([]);
  const [sources,     setSources]     = useState<CrmConversionSource[]>([]);
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    if (!calendarId) return;
    setError(null);

    try {
      const [convRes, srcRes] = await Promise.all([
        fetch(`/api/appointments/calendars/${calendarId}/conversions`),
        fetch("/api/appointments/conversion-sources"),
      ]);

      if (!convRes.ok) throw new Error("Erro ao carregar conversões");
      if (!srcRes.ok)  throw new Error("Erro ao carregar origens");

      const convJson = await convRes.json() as { conversions?: AppointmentConversion[] };
      const srcJson  = await srcRes.json()  as { sources?:     CrmConversionSource[]  };

      if (mountedRef.current) {
        setConversions(convJson.conversions ?? []);
        setSources(srcJson.sources ?? []);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar configurações";
      if (mountedRef.current) setError(msg);
    }
  }, [calendarId]);

  useEffect(() => {
    mountedRef.current = true;
    if (!calendarId) return;
    setIsLoading(true);
    refetch().finally(() => { if (mountedRef.current) setIsLoading(false); });
    return () => { mountedRef.current = false; };
  }, [calendarId, refetch]);

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const upsertConversion = useCallback(async (data: NewAppointmentConversion): Promise<boolean> => {
    if (!calendarId) return false;
    const res = await fetch(`/api/appointments/calendars/${calendarId}/conversions`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    if (!res.ok) {
      const json = await res.json() as { error?: string };
      toast.error(json.error ?? "Erro ao salvar conversão");
      return false;
    }
    await refetch();
    return true;
  }, [calendarId, refetch]);

  const updateConversion = useCallback(async (id: string, data: UpdateAppointmentConversion): Promise<boolean> => {
    if (!calendarId) return false;
    const res = await fetch(`/api/appointments/calendars/${calendarId}/conversions/${id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    if (!res.ok) {
      const json = await res.json() as { error?: string };
      toast.error(json.error ?? "Erro ao atualizar conversão");
      return false;
    }
    await refetch();
    return true;
  }, [calendarId, refetch]);

  const deleteConversion = useCallback(async (id: string): Promise<boolean> => {
    if (!calendarId) return false;
    const res = await fetch(`/api/appointments/calendars/${calendarId}/conversions/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const json = await res.json() as { error?: string };
      toast.error(json.error ?? "Erro ao remover conversão");
      return false;
    }
    toast.success("Conversão removida");
    await refetch();
    return true;
  }, [calendarId, refetch]);

  return {
    conversions,
    sources,
    isLoading,
    error,
    refetch,
    upsertConversion,
    updateConversion,
    deleteConversion,
  };
}
