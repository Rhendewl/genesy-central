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

function sameApplicationServerKey(subscription: PushSubscription, expected: Uint8Array): boolean {
  const current = subscription.options.applicationServerKey;
  if (!current) return false;
  const bytes = new Uint8Array(current);
  return bytes.length === expected.length && bytes.every((value, index) => value === expected[index]);
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
  const applicationServerKey = urlBase64ToUint8Array(publicKey);

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  // Uma rotação de VAPID invalida silenciosamente inscrições antigas. O
  // navegador continua devolvendo a subscription anterior, então precisamos
  // recriá-la com a chave atualmente configurada.
  if (subscription && !sameApplicationServerKey(subscription, applicationServerKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as unknown as BufferSource,
    });
  }

  const res = await fetch("/api/notifications/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    credentials: "same-origin",
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(json.error ?? "Erro ao salvar inscrição de push.");
  }

  return subscription;
}
