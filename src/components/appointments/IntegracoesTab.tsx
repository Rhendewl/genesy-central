"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams }             from "next/navigation";
import { GoogleCalendarCard }          from "@/components/appointments/integrations/GoogleCalendarCard";

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

export function IntegracoesTab() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense>
        <OAuthToast />
      </Suspense>

      {/* Grid of integration cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <GoogleCalendarCard />
      </div>
    </div>
  );
}
