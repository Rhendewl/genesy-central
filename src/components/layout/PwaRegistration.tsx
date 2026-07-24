"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function PwaRegistration() {
  const pathname = usePathname();
  const isPublicPage = pathname?.startsWith("/form/") || pathname?.startsWith("/agendar/");

  useEffect(() => {
    if (isPublicPage) return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(async () => {
        if ("Notification" in window && Notification.permission === "granted") {
          const { ensurePushSubscription } = await import("@/lib/notifications/push-client");
          ensurePushSubscription().catch(() => {});
        }
      })
      .catch(() => {});
  }, [isPublicPage]);

  return null;
}
