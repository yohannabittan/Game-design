# Deploy and install

## One-time setup: GitHub Pages

1. Repository settings, Pages, Source: "Deploy from a branch", branch `main`, folder `/ (root)`. Save.
2. The library launcher is then at `https://yohannabittan.github.io/Game-design/` and each game at `https://yohannabittan.github.io/Game-design/games/<slug>/`.
3. The repo contains an empty `.nojekyll` file so Pages serves everything as static files without processing.

There is no build step. Pushing to `main` is the deploy. Pages usually updates within a minute.

## Installing a game on the phone

iPhone (Safari only; other iOS browsers cannot install web apps):

1. Open the game URL in Safari.
2. Share button, "Add to Home Screen", Add.
3. Open it from the icon once while online. From then on it opens and plays with no network.

Android (Chrome):

1. Open the game URL.
2. Menu, "Add to Home screen" or "Install app".
3. Same: open once online, then it works offline.

What makes this work: on first load the game's service worker (`sw.js`) copies every file into the phone's cache. Later launches read from the cache first and never wait for the network. The manifest tells the phone to open it full screen in portrait with the game's icon.

## How updates reach an installed game

1. Bump `CACHE_VERSION` in the game's `sw.js` (for example `gravity-golf-v2`). Without this the phone keeps the old files.
2. Push to `main`.
3. Next time the game is opened while online, the new service worker installs in the background and the game shows a toast: "Update ready. Tap to reload." Tapping loads the new version. If the toast is ignored, the new version is used on the following launch.

Saves live in `localStorage` under `game:<slug>` and survive updates. If the save shape changes, bump `saveVersion` in `game.js` and handle the old shape in `migrate()`.

## Testing before pushing

```
npm run smoke        # every game boots at phone size with zero errors
npm run serve        # then open http://<your-computer-ip>:8080/games/<slug>/ on the phone over wifi
```

Service workers require HTTPS or localhost. Over plain wifi HTTP the game runs but will not install or cache; that is fine for feel testing. Offline testing needs the real Pages URL.

## Troubleshooting

- **Old version keeps showing.** `CACHE_VERSION` was not bumped, or the game has not been opened online since the push. Bump, push, open online, wait for the toast.
- **Stuck badly.** On the phone, clear site data for the Pages domain (iOS: Settings, Safari, Advanced, Website Data). Reinstall from the URL.
- **Icon is a screenshot.** The `apple-touch-icon` PNG failed to load. Check `icons/icon-180.png` exists in the game folder and is listed in `sw.js`.
- **Page scrolls or zooms when playing.** The canvas lost `touch-action: none`, or a DOM element outside the canvas is receiving touches. Games should not add DOM.
