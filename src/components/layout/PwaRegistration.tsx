"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const PUSH_REFRESH_THROTTLE_MS = 5 * 60_000;
const APP_VERSION_KEY = "genesy-pwa-version";

export function PwaRegistration() {
  const pathname = usePathname();
  const isPublicPage = ["/simular/", "/form/", "/agendar/", "/analise-comercial/", "/coleta/"].some((prefix) => pathname?.startsWith(prefix));

  useEffect(() => {
    if (isPublicPage) return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let cancelled = false;
    let lastRefreshAt = 0;

    const checkForAppUpdate = async () => {
      try {
        const response = await fetch("/api/app-version", { cache: "no-store" });
        if (!response.ok) return;
        const { version } = await response.json() as { version?: string };
        if (!version || cancelled) return;
        const currentVersion = window.localStorage.getItem(APP_VERSION_KEY);
        window.localStorage.setItem(APP_VERSION_KEY, version);
        if (currentVersion && currentVersion !== version) window.location.reload();
      } catch {
        // A atualização é opcional: a plataforma continua disponível offline.
      }
    };

    const refreshPush = async (force = false) => {
      if (cancelled || !("Notification" in window) || Notification.permission !== "granted") return;
      const now = Date.now();
      if (!force && now - lastRefreshAt < PUSH_REFRESH_THROTTLE_MS) return;
      lastRefreshAt = now;

      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.update().catch(() => undefined);
        const { ensurePushSubscription } = await import("@/lib/notifications/push-client");
        await ensurePushSubscription();
      } catch (error) {
        lastRefreshAt = 0;
        console.warn("[pwa] Não foi possível renovar a inscrição push:", error);
      }
    };

    navigator.serviceWorker.register("/sw.js", { scope: "/" })
      .then(async registration => {
        await registration.update().catch(() => undefined);
        void checkForAppUpdate();
        void refreshPush(true);
      })
      .catch(error => console.warn("[pwa] Falha ao registrar Service Worker:", error));

    const onVisible = () => {
      if (document.visibilityState === "visible") { void checkForAppUpdate(); void refreshPush(); }
    };
    const onOnline = () => { void checkForAppUpdate(); void refreshPush(true); };
    const onControllerChange = () => { void refreshPush(true); };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onOnline);
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onOnline);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, [isPublicPage, pathname]);

  return null;
}
