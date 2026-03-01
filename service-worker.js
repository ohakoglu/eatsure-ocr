const CACHE = "eatsure-ocr-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Backend çağrılarını cache'lemeyelim
  if (req.url.includes("/analyze-label") || req.url.includes("/scan/")) return;

  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
