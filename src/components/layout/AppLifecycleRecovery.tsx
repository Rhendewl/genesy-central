"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { useGlobalStore } from "@/store";
import { canRemountAppForRecovery } from "@/lib/app-lifecycle-recovery";

const RECOVERY_THROTTLE_MS = 5_000;

/**
 * Recria apenas a árvore visual quando o documento volta do BFCache ou de uma
 * queda de rede. Alternar entre abas não remonta a interface: assim filtros,
 * edições e a posição atual da página permanecem intactos.
 */
export function AppLifecycleRecovery({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [generation, setGeneration] = useState(0);
  const lastRecoveryRef = useRef(0);
  const recoveringRef = useRef(false);

  const recover = useCallback(async () => {
    const now = Date.now();
    if (recoveringRef.current || now - lastRecoveryRef.current < RECOVERY_THROTTLE_MS) return;

    recoveringRef.current = true;
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.getSession();
      if (error) return;

      if (!data.session) {
        window.location.replace("/auth");
        return;
      }

      lastRecoveryRef.current = now;

      // Um modal aberto contém estado local ainda não salvo (ex.: notas do
      // card de lead). Remontar a árvore nesse momento apagaria o rascunho e
      // a seleção atual. A sessão já foi validada acima; apenas adiamos a
      // reconstrução visual, que só é necessária quando a interface travou.
      const state = useGlobalStore.getState();
      if (!canRemountAppForRecovery(state.modalCount, state.statePreservationCount, pathname)) return;

      setGeneration(current => current + 1);
    } finally {
      recoveringRef.current = false;
    }
  }, [pathname]);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.setTimeout(() => { void recover(); }, 0);
    };

    const onOnline = () => {
      window.setTimeout(() => { void recover(); }, 0);
    };

    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("online", onOnline);

    return () => {
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("online", onOnline);
    };
  }, [recover]);

  return <Fragment key={generation}>{children}</Fragment>;
}
