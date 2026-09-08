"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEVELOPMENT_APP_VERSION, hasNewAppVersion, normalizeAppVersion } from "@/lib/app-version";
import { useGlobalStore } from "@/store";

const VERSION_CHECK_INTERVAL_MS = 60_000;
const DISMISSED_VERSION_KEY = "genesy-dismissed-app-version";
const loadedVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? DEVELOPMENT_APP_VERSION;

function getDismissedVersion() {
  try {
    return window.sessionStorage.getItem(DISMISSED_VERSION_KEY);
  } catch {
    return null;
  }
}

function rememberDismissedVersion(version: string) {
  try {
    window.sessionStorage.setItem(DISMISSED_VERSION_KEY, version);
  } catch {
    // Alguns modos privados bloqueiam o storage; o aviso ainda pode ser fechado.
  }
}

export function AppVersionNotifier() {
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const modalCount = useGlobalStore((state) => state.modalCount);
  const statePreservationCount = useGlobalStore((state) => state.statePreservationCount);

  const checkVersion = useCallback(async () => {
    if (document.visibilityState === "hidden") return;

    try {
      const response = await fetch(`/api/version?checkedAt=${Date.now()}`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return;

      const payload = await response.json() as { version?: unknown };
      if (!hasNewAppVersion(loadedVersion, payload.version)) return;

      const version = normalizeAppVersion(payload.version);
      if (!version || getDismissedVersion() === version) return;
      setAvailableVersion(version);
    } catch {
      // A checagem é silenciosa quando o dispositivo está sem conexão.
    }
  }, []);

  useEffect(() => {
    void checkVersion();
    const interval = window.setInterval(() => { void checkVersion(); }, VERSION_CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void checkVersion();
    };
    const onOnline = () => { void checkVersion(); };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [checkVersion]);

  if (!availableVersion) return null;

  const dismiss = () => {
    rememberDismissedVersion(availableVersion);
    setAvailableVersion(null);
  };

  const updateNow = () => {
    const hasProtectedWork = modalCount > 0 || statePreservationCount > 0;
    if (hasProtectedWork && !window.confirm("Há uma edição ou janela aberta. Deseja atualizar agora mesmo?")) return;
    setUpdating(true);
    window.location.reload();
  };

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[120] mx-auto max-w-md overflow-hidden rounded-2xl border p-3 shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:mx-0 sm:w-[410px]"
      style={{
        background: "var(--bg-modal)",
        borderColor: "color-mix(in srgb, var(--accent-blue) 45%, var(--glass-border))",
        boxShadow: "0 20px 55px rgba(0,0,0,.28)",
      }}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#27a3ff]/15 text-[var(--accent-blue)]">
          <Sparkles size={19} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--text-title)]">Nova versão disponível</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
            Atualize para receber as melhorias e correções mais recentes.
          </p>
        </div>
        <button type="button" onClick={dismiss} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--muted-foreground)] transition hover:bg-[var(--hover)] hover:text-[var(--text-title)]" aria-label="Lembrar depois">
          <X size={15} />
        </button>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={dismiss}>Depois</Button>
        <Button type="button" size="sm" onClick={updateNow} loading={updating} loadingLabel="Atualizando…" icon={<RefreshCw />}>
          Atualizar agora
        </Button>
      </div>
    </aside>
  );
}
