/* BLUSHIFT service worker — offline app shell so it installs & runs like a native app */
const CACHE = 'blushift-beta-v3';
const ASSETS = [
  './',
  './index.html',
  './download.html',
  './BLUSHIFT Beta V1.html',
  './manifest.webmanifest',
  './css/themes.css',
  './css/app.css',
  './css/animations.css',
  './js/data.js',
  './js/boot.js',
  './js/app.js',
  './js/pwa.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // cache each asset independently so one failure can't abort install
    await Promise.allSettled(ASSETS.map((a) => c.add(a)));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // only manage our own origin; fonts/flags/emoji go straight to the network
  if (url.origin !== location.origin) return;
  // NETWORK-FIRST: always try the live file so updates (code, icons) show immediately;
  // fall back to cache only when offline. (Cache-first previously pinned stale assets.)
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    } catch (err) {
      const cached = await caches.match(req);
      return cached || (await caches.match('./BLUSHIFT Beta V1.html')) || Response.error();
    }
  })());
});
