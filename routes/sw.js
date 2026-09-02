/**
 * sw.js — Service worker : notifications push pour les appels Zoom
 * Servi à la racine (/sw.js) pour avoir la portée la plus large possible.
 */
self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {
    data = { title: 'Appel Zoom', body: (event.data && event.data.text()) || 'Votre professeur vous appelle' };
  }
  var title = data.title || 'Appel Zoom';
  var options = {
    body: data.body || 'Votre professeur vous appelle en visio.',
    icon: data.icon || 'https://pub-629428d185ca4960a0a73c850d32294b.r2.dev/company_83078/images/933a6647-1e04-4982-bc9f-b6d67608ce89.png',
    badge: data.icon || 'https://pub-629428d185ca4960a0a73c850d32294b.r2.dev/company_83078/images/933a6647-1e04-4982-bc9f-b6d67608ce89.png',
    vibrate: [300, 150, 300, 150, 300],
    requireInteraction: true,
    tag: 'medin-zoom-call',
    renotify: true,
    data: { url: data.url || '/espace-eleve' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/espace-eleve';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var c = clientList[i];
        if (c.url.indexOf('/espace-eleve') !== -1 && 'focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
