// This service worker unregisters itself immediately so it cannot interfere
// with the proxy. The proxy runs entirely on the same origin (/px?url=...) so
// any SW that intercepts fetches will break proxied pages.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // 1. Wipe all caches
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      // 2. Unregister this SW so it never runs again
      .then(() => self.registration.unregister())
      // 3. Force all open tabs to reload so the dead SW is gone
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => clients.forEach(c => {
        try { c.navigate(c.url); } catch(e) {}
      }))
  );
});

// Never intercept any fetches — if activate fires before unregister completes,
// falling through (no respondWith) lets the browser handle requests natively.
self.addEventListener('fetch', () => { /* intentional no-op */ });
