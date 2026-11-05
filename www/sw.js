// PRICO AI service worker: app shell cache-first, API network-only, media cache with size cap.
const V = 'prico-v2';
const SHELL = ['/', '/index.html', '/app.css?v=1', '/app.js', '/core.js', '/feed.js', '/create.js', '/reelsui.js', '/icons.js', '/i18n.js', '/i18n/en.js', '/logo.svg', '/fonts/MA-ExtraBold.ttf', '/icons/icon-192.png', '/manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== 'prico-prev').map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.startsWith('/api/preview/')) {
    e.respondWith(caches.open('prico-prev').then(async c => { const hit = await c.match(e.request); if (hit) return hit; const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r; }));
    return;
  }
  if (u.pathname.startsWith('/api/') || u.pathname.startsWith('/m/') || u.pathname.startsWith('/p/')) return;
  e.respondWith(caches.match(e.request).then(hit => {
    const net = fetch(e.request).then(r => { if (r.ok) caches.open(V).then(c => c.put(e.request, r.clone())); return r; }).catch(() => hit || caches.match('/index.html'));
    return hit || net;
  }));
});
