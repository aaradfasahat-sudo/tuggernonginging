self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Only handle requests for our own static assets.
// Proxy requests (/px?url=...) and navigation requests MUST be passed
// straight to the network by the browser — never call respondWith() on
// them, because that causes the SW to re-fetch them from inside the
// service-worker context (which lacks cookies/headers and fails).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Never touch: proxy endpoint, suggestions, any non-GET, navigation
  if (
    req.method !== 'GET' ||
    req.mode === 'navigate' ||
    url.pathname.startsWith('/px') ||
    url.pathname.startsWith('/suggestions') ||
    url.search.includes('url=')
  ) {
    return; // Let the browser handle it natively — do NOT call respondWith()
  }

  // For our own static assets: network-first, silent fallback
  event.respondWith(
    fetch(req).catch(() => new Response('', { status: 503 }))
  );
});
