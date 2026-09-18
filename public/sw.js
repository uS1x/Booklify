/* Service Worker: Offline-Grundfunktionen + Web Push */

const VERSION = "v1";
const STATIC_CACHE = `regal-static-${VERSION}`;
const PAGE_CACHE = `regal-pages-${VERSION}`;
const IMAGE_CACHE = `regal-images-${VERSION}`;

const PRECACHE = ["/offline", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("regal-") && !key.endsWith(VERSION))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

/** Seitenaufrufe: erst Netzwerk, bei Ausfall zuletzt gesehene Seite, sonst /offline. */
async function handlePageRequest(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offline = await caches.match("/offline");
    return (
      offline ??
      new Response("<h1>Offline</h1>", { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } })
    );
  }
}

/** Statische Assets: Cache zuerst, im Hintergrund aktualisieren. */
async function handleStaticRequest(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    fetch(request)
      .then((response) => response.ok && cache.put(request, response.clone()))
      .catch(() => {});
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Server Actions, APIs und Auth nie aus dem Cache bedienen.
  if (sameOrigin && (url.pathname.startsWith("/api/") || url.pathname.startsWith("/login") || url.pathname.startsWith("/register"))) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handlePageRequest(request));
    return;
  }

  if (sameOrigin && (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons/"))) {
    event.respondWith(handleStaticRequest(request, STATIC_CACHE));
    return;
  }

  if (request.destination === "image") {
    event.respondWith(
      handleStaticRequest(request, IMAGE_CACHE).catch(() => Response.error()),
    );
  }
});

/* ── Web Push ───────────────────────────────────────────────────────────── */

self.addEventListener("push", (event) => {
  let payload = { title: "Bücherregal", body: "", href: "/notifications" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon ?? "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload.tag,
      data: { href: payload.href ?? "/notifications" },
      lang: "de",
      vibrate: [80, 40, 80],
      renotify: Boolean(payload.tag),
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data?.href ?? "/notifications";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        const url = new URL(client.url);
        if (url.origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) await client.navigate(href);
          return;
        }
      }
      await self.clients.openWindow(href);
    })(),
  );
});
