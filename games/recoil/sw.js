// Offline-first service worker.
// Bump CACHE_VERSION on every deploy so phones pick up the new build.
const CACHE_VERSION = 'recoil-v27';
// Only this game's own dev caches are cleaned up; other games and the release channel share the origin.
const CACHE_PREFIX = 'recoil-v';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/engine.js',
  './src/game.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
  './assets/gun-assassins-scope-bronze.webp',
  './assets/gun-assassins-scope-carbon.webp',
  './assets/gun-assassins-scope-ghost.webp',
  './assets/gun-assassins-scope.webp',
  './assets/gun-buddy-cop-blackout.webp',
  './assets/gun-buddy-cop-gold.webp',
  './assets/gun-buddy-cop-nickel.webp',
  './assets/gun-buddy-cop.webp',
  './assets/gun-make-my-day-frost.webp',
  './assets/gun-make-my-day-ivory.webp',
  './assets/gun-make-my-day.webp',
  './assets/gun-one-man-army-brass.webp',
  './assets/gun-one-man-army-hazard.webp',
  './assets/gun-one-man-army.webp',
  './assets/gun-pulse-rifle-arctic.webp',
  './assets/gun-pulse-rifle-desert.webp',
  './assets/gun-pulse-rifle.webp',
  './assets/gun-spin-lever-tactical.webp',
  './assets/gun-spin-lever-walnut.webp',
  './assets/gun-spin-lever.webp',
  './assets/title-backlot88.png',
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
