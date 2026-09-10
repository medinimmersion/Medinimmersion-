// sw.js — Service worker Médin'Immersion
// Rôle : recevoir les notifications push envoyées par le serveur (ex: appel Zoom
// du professeur) et les afficher, même si le site n'est pas ouvert.

const ICON = 'https://pub-629428d185ca4960a0a73c850d32294b.r2.dev/company_83078/images/933a6647-1e04-4982-bc9f-b6d67608ce89.png';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}

  const title = data.title || "Médin'Immersion";
  const options = {
    body: data.body || 'Vous avez une notification.',
    icon: ICON,
    badge: ICON,
    tag: 'medin-call',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200, 100, 400],
    data: { url: data.url || '/espace-eleve' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/espace-eleve';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('espace-eleve') && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
