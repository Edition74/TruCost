// Offline cache for the TruCost app shell. Bump VERSION whenever any file changes.
const VERSION = 'trucost-v0.12.1';
const FILES = [
  './', 'index.html', 'style.css', 'calc.js', 'app.js', 'manifest.webmanifest',
  'mascot.webp', 'mascot-thinking.webp', 'mascot-shrug.webp', 'mascot-cheer.webp', 'mascot-shock.webp',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'fonts/lilita-one-latin-400-normal.woff2', 'fonts/share-tech-mono-latin-400-normal.woff2',
  'fonts/fredoka-latin-400-normal.woff2', 'fonts/fredoka-latin-500-normal.woff2',
  'fonts/fredoka-latin-600-normal.woff2', 'fonts/fredoka-latin-700-normal.woff2',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first so updates arrive when online; cache when offline.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html')))
  );
});
