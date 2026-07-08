"use client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(rawData.length));

  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }

  return output;
}

export async function ensurePushSubscription(options?: { requestPermission?: boolean }): Promise<PushSubscription | null> {
  if (typeof window === "undefined") return null;
  if (!("Notification" in window)) throw new Error("Seu navegador não suporta notificações.");
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Seu navegador não suporta Web Push.");
  }

  let permission = Notification.permission;
  if (permission === "default" && options?.requestPermission) {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return null;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY não configurada.");

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
    });
  }

  const res = await fetch("/api/notifications/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(json.error ?? "Erro ao salvar inscrição de push.");
  }

  return subscription;
}
