/**
 * Service worker for the installed app.
 *
 * It exists for one job: showing a notification when the push service wakes
 * the browser. There is deliberately no caching here — the casino is entirely
 * live data, and a stale cached balance would be worse than a slow one.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }

  const title = payload.title || 'IttolecHub';
  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    // Same tag replaces rather than stacks: three reminders about the same
    // chest is how people turn notifications off.
    tag: payload.tag || 'ittolec',
    renotify: false,
    data: { url: payload.url || '/casino' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/casino';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // Reuse a tab that is already open rather than piling up windows.
      for (const client of list) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
