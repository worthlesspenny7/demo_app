/*
 * Rally Trainer service worker (MOB-023). Hand-written, no library.
 * - install: precache the built app shell (index.html, the hashed JS/CSS chunks, the manifest and icons). The build
 *   (vite.config.ts, plugin "rally-sw") replaces the two placeholders below with the real file list and a build hash.
 * - fetch: navigations are network-first (a reload picks up a new build: "update on reload") and fall back to the cached
 *   shell offline; every other same-origin GET is cache-first, filled from the network on a miss.
 * - activate: old caches are deleted and the new worker claims the open pages.
 */
const VERSION = '__RALLY_BUILD__';
const PRECACHE = /*__RALLY_PRECACHE__*/['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
const CACHE = `rally-trainer-${VERSION}`;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // one by one so a missing optional file never fails the whole install
    await Promise.all(PRECACHE.map(u => cache.add(new Request(u, { cache: 'reload' })).catch(() => undefined)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('rally-trainer-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => { if (event.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) cache.put('./index.html', fresh.clone()).catch(() => undefined);
        return fresh;
      } catch {
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok && fresh.type === 'basic') cache.put(req, fresh.clone()).catch(() => undefined);
      return fresh;
    } catch {
      return Response.error();
    }
  })());
});
