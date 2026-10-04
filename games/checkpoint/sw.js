// Offline-first service worker.
// Bump CACHE_VERSION on every deploy so phones pick up the new build.
const CACHE_VERSION = 'checkpoint-v11';
// Only this game's own dev caches are cleaned up; other games and the release channel share the origin.
const CACHE_PREFIX = 'checkpoint-v';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/engine.js',
  './src/game.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
  './assets/item-banana.webp',
  './assets/item-batteries.webp',
  './assets/item-belt-buckle.webp',
  './assets/item-belt.webp',
  './assets/item-book.webp',
  './assets/item-box-cutter.webp',
  './assets/item-brass-knuckles.webp',
  './assets/item-cable.webp',
  './assets/item-camera.webp',
  './assets/item-charger.webp',
  './assets/item-coins.webp',
  './assets/item-earrings.webp',
  './assets/item-explosives.webp',
  './assets/item-fireworks.webp',
  './assets/item-fork.webp',
  './assets/item-glasses.webp',
  './assets/item-gun.webp',
  './assets/item-hair-clip.webp',
  './assets/item-hairdryer.webp',
  './assets/item-hammer.webp',
  './assets/item-headphones.webp',
  './assets/item-keys.webp',
  './assets/item-knee-brace.webp',
  './assets/item-knife.webp',
  './assets/item-knitting-needles.webp',
  './assets/item-laptop.webp',
  './assets/item-large-liquid.webp',
  './assets/item-lighter.webp',
  './assets/item-mug.webp',
  './assets/item-multi-tool.webp',
  './assets/item-pen.webp',
  './assets/item-perfume.webp',
  './assets/item-phone.webp',
  './assets/item-power-bank.webp',
  './assets/item-ring.webp',
  './assets/item-scissors.webp',
  './assets/item-shirt.webp',
  './assets/item-shoes.webp',
  './assets/item-small-liquid.webp',
  './assets/item-snacks.webp',
  './assets/item-snow-globe.webp',
  './assets/item-stapler.webp',
  './assets/item-sunglasses.webp',
  './assets/item-tablet.webp',
  './assets/item-tape-measure.webp',
  './assets/item-taser.webp',
  './assets/item-toothbrush.webp',
  './assets/item-toy-gun.webp',
  './assets/item-toy.webp',
  './assets/item-umbrella.webp',
  './assets/item-underwire.webp',
  './assets/item-usb-stick.webp',
  './assets/item-wallet.webp',
  './assets/item-water-bottle.webp',
  './assets/item-wristwatch.webp',
  './assets/item-zipper.webp',
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
