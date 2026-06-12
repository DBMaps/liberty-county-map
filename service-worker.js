const GRIDLY_PWA_CACHE_NAME = "gridly-pwa-shell-v278-1b";
const GRIDLY_PWA_SHELL_URLS = [
  "./",
  "./index.html",
  "./css/styles.css?v=129",
  "./js/app.js?v=1711",
  "./js/gridlyTxdotService.js?v=1710",
  "./manifest.json",
  "./assets/favicon-32.png",
  "./assets/icon-180.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/store/icons/gridly-icon-master-1024.png",
  "./assets/store/branding/Logos/gridly-logo-horizontal.png",
  "./assets/store/branding/Logos/gridly-logo-vertical.png",
  "./assets/store/branding/Splash/gridly-splash-portrait.png",
  "./assets/store/branding/Splash/gridly-splash-landscape.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(GRIDLY_PWA_CACHE_NAME)
      .then((cache) => cache.addAll(GRIDLY_PWA_SHELL_URLS))
      .catch(() => undefined)
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith("gridly-pwa-shell-") && cacheName !== GRIDLY_PWA_CACHE_NAME)
        .map((cacheName) => caches.delete(cacheName))
    ))
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!request || request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("./index.html"))
    );
    return;
  }

  const shellUrl = GRIDLY_PWA_SHELL_URLS
    .map((url) => new URL(url, self.location.href).href)
    .find((url) => url === requestUrl.href);

  if (!shellUrl) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const responseCopy = response.clone();
          caches.open(GRIDLY_PWA_CACHE_NAME).then((cache) => cache.put(request, responseCopy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
