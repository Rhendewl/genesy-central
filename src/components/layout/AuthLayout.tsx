"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";
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

  return (
    <>
      <main className={isAuthenticated ? "min-h-dvh pb-28 lg:pb-0 lg:pl-[80px]" : "min-h-dvh"}>
        {children}
      </main>

      {isAuthenticated && <Dock />}
    </>
  );
}
