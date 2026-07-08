"use client";

import { useEffect } from "react";
import { ensurePushSubscription } from "@/lib/notifications/push-client";

export function PwaRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(() => {
        if ("Notification" in window && Notification.permission === "granted") {
          ensurePushSubscription().catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  return null;
}
