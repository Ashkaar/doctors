// Doctors service worker: makes the app installable and quick to open.
//
// Patient information must never be kept on a device, which may be shared
// by reception, nurses and doctors. So this worker keeps ONLY:
// - the app's own files (/_next/static/…, icons), cache first; their names
//   change with every deploy, so a kept file is never stale;
// - /offline.html, shown when a page can't load.
// Pages and API answers always go to the network and are never stored.
//
// Bump VERSION to drop everything kept by an older worker.

const VERSION = "doctors-v1";
const OFFLINE_PAGE = "/offline.html";
const ASSETS = `${VERSION}-assets`;
const MAX_ASSETS = 400;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(ASSETS);
      await cache.add(OFFLINE_PAGE).catch(() => {});
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length > MAX_ASSETS) await Promise.all(keys.slice(0, keys.length - MAX_ASSETS).map((k) => cache.delete(k)));
}

async function asset(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    trim(cache);
  }
  return response;
}

async function page(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(ASSETS);
    return (await cache.match(OFFLINE_PAGE)) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/static/") || /^\/(icon-(192|512)|icon-maskable-512|apple-touch-icon)\.png$/.test(url.pathname)) {
    event.respondWith(asset(request));
    return;
  }
  if (request.mode === "navigate") event.respondWith(page(request));
  // Everything else (API answers, patient files) goes straight to the network.
});

// Signing out: nothing about patients is kept, but drop everything anyway.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "forget") {
    event.waitUntil(caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n)))));
  }
});
