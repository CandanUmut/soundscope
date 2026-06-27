// SoundScope service worker — offline support for field use.
//
// Strategy:
//   - Precache the stable app-shell entry points on install.
//   - Runtime: navigation requests fall back to the cached shell when offline;
//     other same-origin GETs use stale-while-revalidate, so Vite's hashed
//     assets get cached on first use without the SW needing their names.
//
// Bump CACHE_VERSION to invalidate old caches on deploy.

const CACHE_VERSION = 'soundscope-v1';
const SCOPE_URL = new URL(self.registration.scope);

// Precache shell relative to the SW scope (works under /<repo>/ on Pages).
const SHELL = [
  '.',
  'index.html',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png'
].map((p) => new URL(p, SCOPE_URL).toString());

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never cache cross-origin

  // App navigations: serve cached shell when the network is unavailable.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match(new URL('index.html', SCOPE_URL).toString()).then((r) => r || caches.match(req)))
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
