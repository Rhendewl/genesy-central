"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams }                        from "next/navigation";
import { GoogleCalendarCard }                     from "@/components/appointments/integrations/GoogleCalendarCard";
import { CrmIntegrationCard }               from "@/components/appointments/integrations/CrmIntegrationCard";
import type { AppointmentCalendar }        from "@/types/appointments";

function OAuthToast() {
  const searchParams = useSearchParams();
  const toastRef     = useRef<HTMLDivElement | null>(null);

  const isConnected = searchParams.get("google_connected");
  const isError     = searchParams.get("google_error");

  useEffect(() => {
    if (!isConnected && !isError) return;
    const el = toastRef.current;
    if (!el) return;
    el.style.opacity = "1";
    const t = setTimeout(() => { el.style.opacity = "0"; }, 4000);
    return () => clearTimeout(t);
  }, [isConnected, isError]);

  if (!isConnected && !isError) return null;

  return (
    <div
      ref={toastRef}
      className="px-4 py-3 rounded-xl text-sm font-medium transition-opacity duration-500"
      style={{
        background: isConnected ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
        color:      isConnected ? "#22c55e" : "#ef4444",
        border:     `1px solid ${isConnected ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
      }}
    >
      {isConnected
        ? "Google Calendar conectado com sucesso."
        : isError === "no_refresh_token"
          ? "Autorização incompleta. Clique em conectar novamente e permita o acesso offline."
          : "Erro ao conectar o Google Calendar. Tente novamente."}
    </div>
  );
}

interface Props {
  calendars: AppointmentCalendar[];
}

export function IntegracoesTab({ calendars }: Props) {
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>(
    calendars[0]?.id ?? "",
  );

  // Keep selection valid when calendars list loads/changes
  useEffect(() => {
    if (!selectedCalendarId && calendars.length > 0) {
      setSelectedCalendarId(calendars[0].id);
    }
  }, [calendars, selectedCalendarId]);

  const selectedCalendar = calendars.find(c => c.id === selectedCalendarId);

  return (
    <div className="flex flex-col gap-6">
      <Suspense>
        <OAuthToast />
      </Suspense>

      {/* Section: conta — global (não por calendário) */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
          Conta
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <GoogleCalendarCard />
        </div>
      </div>

      {/* Section: por calendário */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
            Por calendário
          </p>
          {calendars.length > 0 && (
            <select
              value={selectedCalendarId}
              onChange={e => setSelectedCalendarId(e.target.value)}
              className="text-sm rounded-lg px-3 py-1.5 border outline-none"
              style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text-title)" }}
            >
              {calendars.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        {calendars.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Crie um calendário para configurar integrações.
          </p>
        ) : selectedCalendar ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <CrmIntegrationCard calendarId={selectedCalendar.id} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
