"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const PUSH_REFRESH_THROTTLE_MS = 5 * 60_000;

export function PwaRegistration() {
  const pathname = usePathname();
  const isPublicPage = pathname?.startsWith("/form/") || pathname?.startsWith("/agendar/");

  useEffect(() => {
    if (isPublicPage) return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let cancelled = false;
    let lastRefreshAt = 0;

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
        console.warn("[pwa] Não foi possível renovar a inscrição push:", error);
      }
    };

    navigator.serviceWorker.register("/sw.js", { scope: "/" })
      .then(() => refreshPush(true))
      .catch(error => console.warn("[pwa] Falha ao registrar Service Worker:", error));

    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshPush();
    };
    const onOnline = () => { void refreshPush(true); };
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
  }, [isPublicPage]);

  return null;
}
