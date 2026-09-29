const CACHE = 'rtnw-tracker-v5.6.2-analytics-cache-bust';
const THEME_INIT_FRESH = '/assets/theme-init.js?v=5.6.2';

const CORE = [
  '/', '/index.html', '/privacy.html', '/manifest.webmanifest',
  THEME_INIT_FRESH,
  '/assets/app.css?v=5.6.1', '/assets/app.js?v=5.6.1',
  '/assets/prontera.webp', '/assets/prontera.mp3',
  '/assets/fatherjunjun-support-qr.png',
  '/icon-192.png', '/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(async cache => {
      // Cache normal core assets.
      const normalCore = CORE.filter(url => url !== THEME_INIT_FRESH);
      await cache.addAll(normalCore);

      // Force a network-fresh copy of theme-init.js so users who previously
      // cached ?v=5.6.1 for one year receive the Analytics code immediately.
      try {
        const freshTheme = await fetch(THEME_INIT_FRESH, { cache: 'no-store' });
        if (freshTheme.ok) await cache.put(THEME_INIT_FRESH, freshTheme.clone());
      } catch (_) {}
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache APIs, the private admin page, or Vercel observability traffic.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_vercel/') ||
    url.pathname === '/feedback-admin.html'
  ) {
    return;
  }

  // IMPORTANT:
  // index.html currently asks for theme-init.js?v=5.6.1, and /assets is served
  // with a one-year immutable cache. Intercept every theme-init request and
  // serve the fresh v5.6.2 URL instead. This fixes existing browsers/PWAs
  // without requiring the user to manually edit index.html.
  if (url.pathname === '/assets/theme-init.js') {
    event.respondWith(
      fetch(THEME_INIT_FRESH, { cache: 'no-store' })
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(cache => cache.put(THEME_INIT_FRESH, copy));
          }
          return res;
        })
        .catch(() => caches.match(THEME_INIT_FRESH))
    );
    return;
  }

  if (req.mode === 'navigate') {
    const cacheKey = url.pathname === '/' ? '/index.html' : url.pathname;
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(cache => cache.put(cacheKey, copy));
          }
          return res;
        })
        .catch(async () =>
          (await caches.match(cacheKey)) || caches.match('/index.html')
        )
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(res => {
          if (res.ok) {
            caches.open(CACHE).then(cache => cache.put(req, res.clone()));
          }
          return res;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(client => 'focus' in client);
      if (existing) return existing.focus();
      return clients.openWindow('/');
    })
  );
});
