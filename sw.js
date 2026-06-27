/* BLUSHIFT service worker — offline app shell so it installs & runs like a native app */
const CACHE = 'blushift-beta-v1';
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
  // network-first for cross-origin (fonts, APIs); cache-first for our own shell
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    } catch (err) {
      // offline fallback to the app shell
      const shell = await caches.match('./BLUSHIFT Beta V1.html');
      return shell || Response.error();
    }
  })());
});
