// public/sw.js
//
// Minimal hand-rolled service worker — no next-pwa or workbox dependency.
//
// Strategy:
//   - Static assets (JS/CSS/fonts/icons): cache-first, falling back to network
//   - Navigation requests (HTML pages): network-first, falling back to cached
//     shell on failure (so the app still opens offline, even if stale)
//   - API requests (/api/*): always network — NEVER cached. Stale booking/
//     inventory/billing data is worse than a clear "you're offline" failure.
//
// Cache versioning: bump CACHE_NAME on any deploy that changes static asset
// hashes significantly; old caches are purged on activate.

const CACHE_NAME = 'bos-shell-v1';

const APP_SHELL = [
  '/',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never cache API calls — always hit the network for live data.
  if (url.pathname.startsWith('/api/')) {
    return; // let it pass through uncached
  }

  // Only handle same-origin GET requests beyond this point.
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Navigation requests: network-first, cached shell as offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match('/').then((res) => res || caches.match(request)))
    );
    return;
  }

  // Static assets: cache-first, network fallback, then cache the network result.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
