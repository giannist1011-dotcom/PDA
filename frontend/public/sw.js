/* OrderDeck service worker — installability + offline shell.
   Cache static assets + index.html ώστε η εφαρμογή να ανοίγει χωρίς ίντερνετ.
   ΔΕΝ κάνει cache κλήσεις API — τα offline data (μενού/ουρά παραγγελιών)
   ζουν σε IndexedDB (βλ. src/lib/offline.js), όχι εδώ. */
const CACHE_NAME = "orderdeck-static-v3";
const PRECACHE = ["/index.html", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Μόνο same-origin static assets — ποτέ API ή cross-origin
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api")) return;

  // Navigation requests: network-first ώστε νέα deploys να φορτώνουν άμεσα
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", copy));
          }
          return resp;
        })
        .catch(() => caches.match("/index.html").then((r) => r || Response.error()))
    );
    return;
  }

  // Hashed static assets (js/css/fonts/εικόνες): cache-first
  const isStatic = /\.(js|css|png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname);
  if (!isStatic) return;

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return resp;
        })
    )
  );
});
