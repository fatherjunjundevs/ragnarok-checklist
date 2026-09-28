const CACHE = 'rtnw-tracker-v5.4.1';
const CORE = [
  '/', '/index.html', '/privacy.html', '/manifest.webmanifest',
  '/assets/theme-init.js?v=5.4.1', '/assets/app.css?v=5.4.1', '/assets/app.js?v=5.4.1',
  '/assets/prontera.webp', '/assets/prontera.mp3', '/assets/fatherjunjun-support-qr.png',
  '/icon-192.png', '/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    const cacheKey = url.pathname === '/' ? '/index.html' : url.pathname;
    event.respondWith(fetch(req).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(cacheKey, copy));
      }
      return res;
    }).catch(async () => (await caches.match(cacheKey)) || caches.match('/index.html')));
    return;
  }

  event.respondWith(caches.match(req).then(cached => {
    const network = fetch(req).then(res => { if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone())); return res; }).catch(() => cached);
    return cached || network;
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list => {
    const existing = list.find(c => 'focus' in c); if (existing) return existing.focus(); return clients.openWindow('/');
  }));
});
