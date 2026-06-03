const CACHE = 'animabing-creator-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// Creator app — hamesha fresh data (API calls)
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

// Push Notifications
self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'AnimaBing Creator', {
      body: data.body || 'Check your dashboard!',
      icon: '/icons/creator-192.png',
      badge: '/icons/creator-192.png',
      data: { url: data.url || '/dashboard' }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data.url));
});