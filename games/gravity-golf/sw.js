// Offline-first service worker.
// Bump CACHE_VERSION on every deploy so phones pick up the new build.
const CACHE_VERSION = 'gravity-golf-v22';
// Only this game's own dev caches are cleaned up; other games and the release channel share the origin.
const CACHE_PREFIX = 'gravity-golf-v';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/engine.js',
  './src/game.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
  './assets/medal-banker.webp',
  './assets/medal-binary-star.webp',
  './assets/medal-clockwork.webp',
  './assets/medal-eclipse.webp',
  './assets/medal-first-orbit.webp',
  './assets/medal-never-landed.webp',
  './assets/medal-perfect-run.webp',
  './assets/medal-slingshot.webp',
  './assets/medal-touchdown.webp',
  './assets/medal-under-par.webp',
  './assets/medal-untouched.webp',
  './assets/rank-01-asteroid.webp',
  './assets/rank-02-moon.webp',
  './assets/rank-03-planet.webp',
  './assets/rank-04-giant-planet.webp',
  './assets/rank-05-brown-dwarf.webp',
  './assets/rank-06-red-dwarf.webp',
  './assets/rank-07-yellow-star.webp',
  './assets/rank-08-blue-star.webp',
  './assets/rank-09-red-giant.webp',
  './assets/rank-10-blue-giant.webp',
  './assets/rank-11-white-dwarf.webp',
  './assets/rank-12-supernova.webp',
  './assets/rank-13-nebula.webp',
  './assets/rank-14-neutron-star.webp',
  './assets/rank-15-quasar.webp',
  './assets/rank-16-black-hole.webp',
  './assets/title-gravity-golf.webp',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' skips the browser's HTTP cache, so a new version never stores the old files.
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first (ADR-0018): online players always get the newest build; the cache answers when the network fails or is
// slower than NET_TIMEOUT, and every good response refreshes it. Never throws.
const NET_TIMEOUT = 3000;
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const fromCache = () => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined));
  const fromNet = fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy)); }
    return res;
  });
  const timeout = new Promise((resolve) => setTimeout(resolve, NET_TIMEOUT));
  event.respondWith(
    Promise.race([fromNet.catch(() => null), timeout])
      .then((res) => (res && res.ok ? res : fromCache().then((hit) => hit || fromNet)))
      .catch(() => fromCache().then((hit) => hit || Response.error()))
  );
});
