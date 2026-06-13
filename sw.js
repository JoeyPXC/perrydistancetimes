const CACHE_NAME = 'perry-distance-v1';

// App shell files to cache on install
// Paths are relative to the service worker's location (/perryboysdistancetimes/)
const APP_SHELL = [
  './',
  './manifest.json',
  './Mass. Perry Black Outline.png',
];

// Install: cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - Google Sheets CSV requests: network-first (always try live data, fall back to cache)
// - Everything else: cache-first (app shell loads instantly offline)
self.addEventListener('fetch', event => {
  const url = event.request.url;

  if (url.includes('docs.google.com') || url.includes('spreadsheets')) {
    // Network-first for live sheet data
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Cache-first for app shell and static assets
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
  }
});
