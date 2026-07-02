const CACHE_NAME = 'perry-distance-v5';

const APP_SHELL = [
  './',
  './manifest.json',
  './Mass. Perry Black Outline.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

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

self.addEventListener('fetch', event => {
  const url = event.request.url;
  const requestUrl = new URL(url);

  // Google Sheets CSVs — network first, fall back to cache.
  //
  // The app appends a "cachebust" timestamp param to every sheet fetch, so
  // the raw request URL is different every time. Two bugs fell out of
  // caching by that raw URL:
  //   1. Cache bloat — every new cachebust value stored ANOTHER full copy
  //      of the same CSV, and none were ever cleaned up. Dozens of sheets
  //      x a new entry every few minutes of use = megabytes of dead weight.
  //   2. Broken offline fallback — when offline, the app generates a FRESH
  //      cachebust value, which never matches any previously-cached URL,
  //      so caches.match() always missed and offline sheet data never
  //      actually worked.
  // Fix for both: strip cachebust and cache under the clean URL — exactly
  // one entry per sheet, always overwritten in place, always findable.
  if (url.includes('docs.google.com') || url.includes('spreadsheets')) {
    const cleanUrl = new URL(url);
    cleanUrl.searchParams.delete('cachebust');
    const cacheKey = new Request(cleanUrl.href);
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Only cache good responses — otherwise a transient Google
          // error page would overwrite the last known-good CSV and
          // become the "offline fallback".
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(cacheKey, clone));
          }
          return response;
        })
        .catch(() => caches.match(cacheKey))
    );
    return;
  }

  // Main HTML file — always network first so updates show immediately.
  // Falls back to cache only if offline.
  //
  // Detecting "this is the main page" by checking request.mode === 'navigate'
  // (the standard, reliable signal for an actual page load) rather than only
  // matching the URL's path. Shared profile links look like
  // ".../perrydistancetimes/?athlete=Connor%20Reed" — that doesn't end in
  // "/" or ".html", so a path-only check would miss it and let it fall
  // through to the cache-first branch below meant for icons/images. That
  // would mean: open a shared link once, and every future visit to that
  // exact link silently serves the stale copy from that first visit instead
  // of checking the network, even though the page itself updates fine
  // otherwise. request.mode catches this (and any other URL shape) since it
  // reflects how the browser is loading the resource, not the URL text.
  const isPageNavigation = event.request.mode === 'navigate' ||
    requestUrl.pathname.endsWith('/') || requestUrl.pathname.endsWith('.html');

  if (isPageNavigation) {
    // Cache under the bare path (no query string) — every shared link
    // (?athlete=...) serves the identical app shell, so there's no reason
    // to store a separate cached copy per link. This also means the
    // offline fallback below finds a match regardless of which athlete
    // link was used to get here.
    const cacheKey = new Request(requestUrl.origin + requestUrl.pathname);
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(cacheKey, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true }))
    );
    return;
  }

  // Everything else (icons, manifest, images) — cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
