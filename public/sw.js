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
