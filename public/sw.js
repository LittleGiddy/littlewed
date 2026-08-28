/* LittleWed service worker — PWA install, offline shell, web push notifications */
const CACHE_NAME = 'littlewed-shell-v1';
const APP_SHELL = ['/', '/login', '/pricing', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // App-shell navigation: network-first, fall back to cache for offline use.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put('/login', copy));
          return res;
        })
        .catch(() => caches.match('/login'))
    );
    return;
  }

  // Static assets: cache-first.
  if (
    event.request.url.includes('/icons/') ||
    event.request.url.includes('/_next/static/') ||
    event.request.url.endsWith('.css') ||
    event.request.url.endsWith('.js')
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
});

/* ─── Web Push ─────────────────────────────────────────────────────────── */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || 'LittleWed';
  const options = {
    body: data.body || 'You have a new notification.',
    icon: data.icon || '/icons/icon-192.png',
    badge: '/icons/icon-maskable-192.png',
    data: { url: data.url || '/', sound: data.sound || false },
    vibrate: data.sound ? [200, 100, 200] : [100],
    tag: data.tag || 'littlewed-default',
    renotify: Boolean(data.sound),
    timestamp: Date.now(),
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );

  // Let any open tab know so it can play a sound / show an in-app toast too.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      clientList.forEach((client) => {
        client.postMessage({ type: 'LITTLEWED_PUSH', payload: { title, body: options.body, url: options.data.url } });
      });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.navigate(target);
      }
      return self.clients.openWindow(target);
    })
  );
});
