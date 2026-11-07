// オフラインでも島を開けるように、アプリ本体を端末にしまっておく
const CACHE = 'hkc-v3';
const FILES = ['./', './index.html', './app.js', './manifest.webmanifest', './icon.svg', './icon-180.png', './icon-192.png', './icon-512.png', './lib/three.module.js', './lib/OrbitControls.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
