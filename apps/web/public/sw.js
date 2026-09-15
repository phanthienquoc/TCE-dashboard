const SW_VERSION = '2026-09-15-pwa-cache-v2';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isApiRequest = url.pathname === '/api' || url.pathname.startsWith('/api/');

  if (isApiRequest) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
  }
});

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'TCE Dashboard updated';
  const body = data.body || 'A new TCE Dashboard version is available.';
  const url = data.url || '/dashboard';
  const version = data.version || SW_VERSION;

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: { url, version, type: data.type || 'SYSTEM_UPDATE' },
      }),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
        clients.forEach(client =>
          client.postMessage({
            type: data.type || 'SYSTEM_UPDATE',
            title,
            body,
            version,
            url,
          })
        );
      }),
    ])
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if ('focus' in client) {
          if ('navigate' in client && new URL(client.url).origin === self.location.origin)
            client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
