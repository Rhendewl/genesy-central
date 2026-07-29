"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { useGlobalStore } from "@/store";
import { canRemountAppForRecovery } from "@/lib/app-lifecycle-recovery";

const LONG_SUSPEND_MS = 60_000;
const RECOVERY_THROTTLE_MS = 5_000;

/**
 * Recria apenas a árvore visual quando o PWA volta de uma suspensão longa,
 * do BFCache ou de uma queda de rede. O provider de perfil fica acima desta
 * árvore e preserva o último usuário válido enquanto páginas e subscriptions
 * realtime são abertas novamente.
 */
export function AppLifecycleRecovery({ children }: { children: ReactNode }) {
  const [generation, setGeneration] = useState(0);
  const hiddenAtRef = useRef<number | null>(
    typeof document !== "undefined" && document.visibilityState === "hidden"
      ? Date.now()
      : null,
  );
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
      if (!canRemountAppForRecovery(useGlobalStore.getState().modalCount)) return;

      setGeneration(current => current + 1);
    } finally {
      recoveringRef.current = false;
    }
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }

      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (hiddenAt !== null && Date.now() - hiddenAt >= LONG_SUSPEND_MS) {
        window.setTimeout(() => { void recover(); }, 0);
      }
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.setTimeout(() => { void recover(); }, 0);
    };

    const onOnline = () => {
      window.setTimeout(() => { void recover(); }, 0);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("online", onOnline);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("online", onOnline);
    };
  }, [recover]);

  return <Fragment key={generation}>{children}</Fragment>;
}
