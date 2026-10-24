// Offline-first service worker.
// Bump CACHE_VERSION on every deploy so phones pick up the new build.
const CACHE_VERSION = 'arena-v42';
// Only this game's own dev caches are cleaned up; other games and the release channel share the origin.
const CACHE_PREFIX = 'arena-v';
// The painted art (docs/art/final/arena, one webp each); the release channel shows it, the dev channel shows the candidates instead.
const ART = [
  './assets/arena-pit.webp', './assets/arena-city.webp', './assets/arena-colosseum.webp', './assets/arena-grand.webp',
  './assets/kit-base-head.webp', './assets/kit-base-torso.webp', './assets/kit-base-forearm.webp', './assets/kit-base-shin.webp',
  './assets/kit-helmet-gallic.webp', './assets/kit-shield-round.webp', './assets/brutus.webp', './assets/brutus-proud.webp',
  './assets/champ-marcus.webp', './assets/champ-aurelius.webp', './assets/champ-flamma.webp', './assets/champ-varro.webp',
  './assets/champ-twins.webp', './assets/champ-hermes.webp', './assets/champ-carpophorus.webp', './assets/champ-mevia.webp',
  './assets/champ-aquila.webp', './assets/emperor.webp', './assets/kit-base-torso-lean.webp', './assets/kit-base-torso-avg.webp',
  './assets/beast-lion-head.webp', './assets/beast-bear-head.webp', './assets/beast-lion-tail.webp', './assets/kit-helmet-murmillo.webp',
  './assets/kit-helmet-thraex.webp', './assets/kit-helmet-secutor.webp', './assets/kit-galerus.webp', './assets/kit-shield-scutum.webp',
  './assets/kit-shield-parma.webp', './assets/kit-plate-chest.webp', './assets/kit-plate-manica.webp', './assets/kit-plate-greave.webp',
  './assets/kit-wrap-trousers.webp', './assets/kit-base-upperarm-seg.webp', './assets/kit-base-thigh-seg.webp',
  './assets/gear-bronze-bracers.webp', './assets/gear-barbed-bracers.webp', './assets/gear-matador-ribbons.webp',
  './assets/gear-iron-pauldrons.webp', './assets/gear-knife-bracers.webp', './assets/gear-gilt-armlets.webp',
  './assets/gear-bronze-crest.webp', './assets/gear-blood-band.webp', './assets/gear-ribbon-band.webp', './assets/gear-horned-cap.webp',
  './assets/gear-dark-hood.webp', './assets/gear-plumed-helm.webp', './assets/gear-bronze-phalerae.webp', './assets/gear-ghost-silk.webp',
  './assets/gear-black-plate.webp', './assets/gear-eye-amulet.webp', './assets/gear-gilded-harness.webp', './assets/gear-bronze-boots.webp',
  './assets/gear-dancers-sandals.webp', './assets/gear-spiked-boots.webp', './assets/gear-soft-boots.webp',
  './assets/gear-gilded-greaves.webp', './assets/gear-hook-belt.webp', './assets/gear-ribbon-sash.webp', './assets/gear-chain-belt.webp',
  './assets/gear-coin-belt.webp', './assets/gear-wolf-pelt.webp', './assets/gear-flowing-cape.webp', './assets/gear-puppeteers-mantle.webp',
  './assets/gear-purple-cloak.webp', './assets/gear-lion-pelt.webp', './assets/gear-spiked-shield.webp', './assets/gear-tower-shield.webp',
  './assets/gear-spiral-shield.webp', './assets/kit-net-draped.webp', './assets/kit-arm-up-lean.webp', './assets/kit-arm-lo-lean.webp',
  './assets/kit-leg-up-lean.webp', './assets/kit-leg-lo-lean.webp', './assets/kit-arm-up-avg.webp', './assets/kit-arm-lo-avg.webp',
  './assets/kit-leg-up-avg.webp', './assets/kit-leg-lo-avg.webp', './assets/beast-lion-fore-up.webp', './assets/beast-lion-fore-lo.webp',
  './assets/beast-lion-hind-up.webp', './assets/beast-lion-hind-lo.webp', './assets/beast-lion-fore-up-young.webp',
  './assets/beast-lion-fore-lo-young.webp', './assets/beast-lion-hind-up-young.webp', './assets/beast-lion-hind-lo-young.webp',
  './assets/beast-bear-fore-up.webp', './assets/beast-bear-fore-lo.webp', './assets/beast-bear-hind-up.webp',
  './assets/beast-bear-hind-lo.webp', './assets/beast-bear-fore-up-young.webp', './assets/beast-bear-fore-lo-young.webp',
  './assets/beast-bear-hind-up-young.webp', './assets/beast-bear-hind-lo-young.webp', './assets/beast-lion-torso.webp',
  './assets/beast-lion-torso-young.webp', './assets/beast-bear-torso.webp', './assets/beast-bear-torso-young.webp'
];
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/engine.js',
  './src/game.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
  ...ART,
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
  if (new URL(req.url).pathname.includes('/docs/art/candidates/')) return; // dev-channel art candidates are never cached (ADR-0020)
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
