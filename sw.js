// Service worker: precaches every file the game needs, serves cache-first, and
// never skips waiting on its own (the page asks, after the player taps the
// update prompt). The block between the markers is written by
// tools/precache.js; don't edit it by hand.

// <precache>
const VERSION = "0dc003f3d1f3";
const CACHE_PREFIX = "wt-";
const FILES = [
  "data/balance.json",
  "data/frames.json",
  "data/manufacturers.json",
  "data/modules.json",
  "icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "index.html",
  "manifest.webmanifest",
  "src/config.js",
  "src/core/blueprint.js",
  "src/core/codec.js",
  "src/core/rng.js",
  "src/core/save.js",
  "src/core/store.js",
  "src/main.js",
  "src/platform/content.js",
  "src/platform/orientation.js",
  "src/platform/serviceWorker.js",
  "src/platform/storage.js",
  "src/render/blueprintStyles.js",
  "src/render/canvas.js",
  "src/render/exterior.js",
  "src/render/hull.js",
  "src/render/loop.js",
  "src/render/mesh.js",
  "src/render/orbit.js",
  "src/render/painter.js",
  "src/render/palette.js",
  "src/render/parts/art.js",
  "src/render/parts/blueprint.js",
  "src/render/pick.js",
  "src/render/props.js",
  "src/render/shipScene.js",
  "src/render/shipView.js",
  "src/render/solid.js",
  "src/render/starfield.js",
  "src/render/svg.js",
  "src/sim/builder.js",
  "src/sim/builds.js",
  "src/sim/constraints.js",
  "src/sim/defs.js",
  "src/sim/frame.js",
  "src/sim/grid.js",
  "src/sim/modules.js",
  "src/sim/replay.js",
  "src/sim/root.js",
  "src/sim/session.js",
  "src/sim/settings.js",
  "src/ui/builder/card.js",
  "src/ui/builder/drawer.js",
  "src/ui/builder/hints.js",
  "src/ui/builder/palette.js",
  "src/ui/builder/savesPanel.js",
  "src/ui/builder/screen.js",
  "src/ui/builder/shipPanel.js",
  "src/ui/dev/fps.js",
  "src/ui/dev/menu.js",
  "src/ui/dev/sandboxes.js",
  "src/ui/gestures.js",
  "src/ui/icons.js",
  "src/ui/screens.js",
  "src/ui/style.css",
  "src/ui/title.js",
  "src/ui/updatePrompt.js",
];
// </precache>

const CACHE = `${CACHE_PREFIX}${VERSION}`;
const INDEX = new URL('index.html', self.registration.scope).href;

self.addEventListener('install', (event) => {
  // cache: 'reload' skips the HTTP cache, so a new version never precaches a
  // stale copy of a file that GitHub Pages told the browser to keep.
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILES.map((file) => new Request(file, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  // Delete this game's old versions only, never caches that belong to anything
  // else on the same origin.
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((n) => n.startsWith(CACHE_PREFIX) && n !== CACHE).map((n) => caches.delete(n))),
      ),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return;
  event.respondWith(request.mode === 'navigate' ? navigate(request) : fromCache(request));
});

async function fromCache(request) {
  return (await caches.match(request, { cacheName: CACHE })) ?? fetch(request);
}

// Navigations: the cached page if there is one (folders mean index.html, and
// query strings such as ?dev=1 are ignored), then the network. Offline,
// index.html is the fallback, reached by redirecting to the start page:
// served at a deeper path, its relative URLs would miss the cache.
async function navigate(request) {
  const url = new URL(request.url);
  const page = url.pathname.endsWith('/') ? new URL('index.html', url).href : url.href;
  const hit = await caches.match(page, { cacheName: CACHE, ignoreSearch: true });
  if (hit) return hit;
  try {
    return await fetch(request);
  } catch (err) {
    if (page !== INDEX && (await caches.match(INDEX, { cacheName: CACHE }))) {
      return Response.redirect(self.registration.scope, 302);
    }
    throw err;
  }
}
