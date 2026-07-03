"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";
import { useGlobalStore } from "@/store";
import { Dock } from "./Dock";

// ─────────────────────────────────────────────────────────────────────────────
// AuthLayout
//
// Responsabilidade única: decidir se o Dock é exibido.
//  - Não autenticado → só {children} (tela de login limpa)
//  - Autenticado     → {children} + <Dock /> + padding-bottom para liberar espaço
//
// Observa mudanças de sessão em tempo real via onAuthStateChange,
// então o Dock some/aparece instantaneamente no login/logout sem refresh.
// ─────────────────────────────────────────────────────────────────────────────

export function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const canvasMode = useGlobalStore((s) => s.canvasMode);
  const [session, setSession] = useState<Session | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();

    // Lê a sessão atual (via cookie — sem round-trip ao servidor)
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsChecking(false);
    });

    // Mantém em sincronia com login/logout
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setIsChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const isAuthenticated = !isChecking && !!session;
  const isPortalPage   = pathname?.startsWith("/portal/")  ?? false;
  const isConvitePage  = pathname?.startsWith("/convite/") ?? false;
  const isFormPage     = pathname?.startsWith("/form/")    ?? false;
  const isAgendarPage  = pathname?.startsWith("/agendar/") ?? false;
  const showDock = isAuthenticated && !isPortalPage && !isConvitePage && !isFormPage && !isAgendarPage;

  // Em canvas mode o Dock se oculta sozinho, mas o padding do <main> precisa
  // ser removido explicitamente para o canvas ocupar 100% da viewport.
  const mainClass = showDock && !canvasMode
    ? "min-h-dvh pb-28 md:pb-0 md:pl-[80px]"
    : "min-h-dvh";

  return (
    <>
      {isAuthenticated && !isAgendarPage && (
        <div
          aria-hidden="true"
          style={{
            position:           "fixed",
            inset:              0,
            zIndex:             -1,
            pointerEvents:      "none",
            backgroundImage:    "url('/bg-premium.jpg')",
            backgroundSize:     "cover",
            backgroundPosition: "center",
            backgroundRepeat:   "no-repeat",
            opacity:            0.4,
          }}
        />
      )}

      <main className={mainClass}>
        {children}
      </main>

      {showDock && <Dock />}
    </>
  );
}
