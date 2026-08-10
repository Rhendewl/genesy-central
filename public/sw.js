// Genesy Service Worker — Push Notification handler
// Scope: / (root)

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Genesy', body: event.data.text() };
  }

  const { title = 'Genesy', body = '', icon = '/favicon.png', tag, url = '/' } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: icon,
      tag,
      renotify: !!tag,
      data: { url },
    })
  );
});

// Chrome/Android dispara este evento quando o provedor troca ou invalida a
// inscrição. Renovamos usando a mesma chave VAPID e sincronizamos o novo
// endpoint com a sessão autenticada, sem exigir que o usuário abra ajustes.
self.addEventListener('pushsubscriptionchange', event => {
  const applicationServerKey = event.oldSubscription?.options?.applicationServerKey;
  if (!applicationServerKey) return;

  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    }).then(subscription => fetch('/api/notifications/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    }))
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      if (clients.length > 0) {
        return clients[0].navigate(destination).then(client => client?.focus());
      }
      return self.clients.openWindow(destination);
    })
  );
});
