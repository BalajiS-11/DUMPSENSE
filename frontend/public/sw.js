const CACHE_NAME = 'dumpsense-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/favicon.svg',
  '/test_image.webp',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Some precache assets failed:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. NEVER intercept non-GET requests (POST /reports must go directly to app logic / IndexedDB)
  if (request.method !== 'GET') {
    return;
  }

  // 2. NEVER cache backend API routes, WebSockets, or dynamic queries
  if (
    url.pathname.startsWith('/reports') ||
    url.pathname.startsWith('/zones') ||
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/classify') ||
    url.pathname.startsWith('/predict') ||
    url.pathname.startsWith('/ws')
  ) {
    return;
  }

  // 3. Navigation requests: Network first -> Cache -> offline.html fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        if (cached) return cached;
        const offlinePage = await cache.match('/offline.html');
        return offlinePage || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      })
    );
    return;
  }

  // 4. Static assets: Cache First with Network Fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Refresh cache in background
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && request.url.startsWith('http')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
        }
        return networkResponse;
      });
    }).catch(() => {
      // Fallback
      return new Response('', { status: 408 });
    })
  );
});

// 5. Background Sync: When connectivity returns, signal clients to drain queue
self.addEventListener('sync', (event) => {
  if (event.tag === 'dumpsense-upload-queue') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'DRAIN_OFFLINE_QUEUE' });
        });
      })
    );
  }
});
