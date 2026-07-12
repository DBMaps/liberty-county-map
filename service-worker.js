const GRIDLY_CLOSURE_CACHE_NAME = "gridly-beta-closure-v1";
const GRIDLY_CLOSURE_URLS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/favicon-32.png",
  "./assets/icon-180.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/store/branding/Logos/gridly-logo-horizontal.png"
];

function isRecognizedOldGridlyCache(cacheName) {
  return /^gridly-pwa-shell-/.test(cacheName)
    || (/^gridly-beta-closure-/.test(cacheName) && cacheName !== GRIDLY_CLOSURE_CACHE_NAME);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(GRIDLY_CLOSURE_CACHE_NAME)
      .then((cache) => cache.addAll(GRIDLY_CLOSURE_URLS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter(isRecognizedOldGridlyCache)
          .map((cacheName) => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!request || request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then((response) => {
          if (response && response.ok) {
            const responseCopy = response.clone();
            caches.open(GRIDLY_CLOSURE_CACHE_NAME).then((cache) => cache.put("./index.html", responseCopy));
          }
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  const closureUrl = GRIDLY_CLOSURE_URLS
    .map((url) => new URL(url, self.location.href).href)
    .find((url) => url === requestUrl.href);

  if (!closureUrl) return;

  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => cachedResponse || fetch(request).then((response) => {
        if (response && response.ok) {
          const responseCopy = response.clone();
          caches.open(GRIDLY_CLOSURE_CACHE_NAME).then((cache) => cache.put(request, responseCopy));
        }
        return response;
      }))
  );
});
