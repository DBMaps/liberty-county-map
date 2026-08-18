(function () {
  "use strict";

  var output = document.getElementById("results");
  var unregisterButton = document.getElementById("unregisterWorker");
  var localDevelopmentHost = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  var lifecycleEvents = [];

  function milliseconds(value) {
    return Number.isFinite(value) ? value.toFixed(1) + " ms" : "unavailable";
  }

  function workerDescription(worker) {
    return worker ? worker.state + " — " + worker.scriptURL : "none";
  }

  async function cacheInventory() {
    if (!("caches" in window)) return ["Cache Storage: unavailable"];
    var names = await caches.keys();
    var lines = ["Cache count: " + names.length];
    for (var index = 0; index < names.length; index += 1) {
      var cache = await caches.open(names[index]);
      var requests = await cache.keys();
      lines.push("Cache: " + names[index] + " (" + requests.length + " entries; byte size not exposed without reading every response)");
    }
    return lines;
  }

  async function registrationsForOrigin() {
    if (!("serviceWorker" in navigator)) return [];
    return navigator.serviceWorker.getRegistrations();
  }

  async function renderState(actionMessage) {
    var navigation = performance.getEntriesByType("navigation")[0];
    var registrations = await registrationsForOrigin();
    var registration = await navigator.serviceWorker?.getRegistration();
    var controller = navigator.serviceWorker?.controller || null;
    var fetchStart = navigation?.fetchStart;
    var workerStart = navigation?.workerStart;
    var lines = [
      "Captured: " + new Date().toISOString(),
      "Page host: " + location.host,
      "Local diagnostic actions allowed: " + localDevelopmentHost,
      "Navigation type: " + (navigation?.type || "unavailable"),
      "Navigation start: 0.0 ms (performance time origin " + new Date(performance.timeOrigin).toISOString() + ")",
      "Worker start: " + milliseconds(workerStart),
      "Fetch start: " + milliseconds(fetchStart),
      "Pre-fetch delay: " + milliseconds(fetchStart),
      "Request start: " + milliseconds(navigation?.requestStart),
      "Response start: " + milliseconds(navigation?.responseStart),
      "Response end: " + milliseconds(navigation?.responseEnd),
      "Controller present: " + Boolean(controller),
      "Controller script: " + (controller?.scriptURL || "none"),
      "Controller state: " + (controller?.state || "none"),
      "Origin registration count: " + registrations.length,
      "Registration for this page: " + Boolean(registration),
      "Registration scope: " + (registration?.scope || "none"),
      "updateViaCache: " + (registration?.updateViaCache || "unavailable"),
      "Installing: " + workerDescription(registration?.installing),
      "Waiting: " + workerDescription(registration?.waiting),
      "Active: " + workerDescription(registration?.active),
      "Last update check: not exposed by the Service Worker API",
      "Navigation preload enabled: " + (registration?.navigationPreload ? String((await registration.navigationPreload.getState()).enabled) : "unavailable"),
      "Lifecycle events observed since this document loaded: " + (lifecycleEvents.length ? lifecycleEvents.join("; ") : "none")
    ];
    lines.push.apply(lines, await cacheInventory());
    if (sessionStorage.getItem("gridlySwDiagnosticUnregistered") === "true") {
      lines.push("Diagnostic state: the explicit temporary unregister action completed before this reload.");
      sessionStorage.removeItem("gridlySwDiagnosticUnregistered");
    }
    if (actionMessage) lines.push("Action: " + actionMessage);
    lines.push("", fetchStart >= 1000 ? "DELAY OBSERVED — capture a screenshot." : "NO MATERIAL PRE-FETCH DELAY ON THIS LOAD.");
    output.textContent = lines.join("\n");
    output.className = fetchStart >= 1000 ? "delay" : "pass";
  }

  function observeRegistration(registration) {
    registration?.addEventListener("updatefound", function () {
      lifecycleEvents.push(milliseconds(performance.now()) + " updatefound");
      registration.installing?.addEventListener("statechange", function () {
        lifecycleEvents.push(milliseconds(performance.now()) + " installing=" + registration.installing?.state);
        renderState();
      });
      renderState();
    });
  }

  document.getElementById("checkState").addEventListener("click", function () { renderState("Current state refreshed without calling registration.update()."); });
  document.getElementById("reloadControl").addEventListener("click", function () { location.reload(); });
  unregisterButton.disabled = !localDevelopmentHost;
  unregisterButton.addEventListener("click", async function () {
    if (!localDevelopmentHost) return;
    unregisterButton.disabled = true;
    var registrations = await registrationsForOrigin();
    var pageUrl = location.href;
    var matching = registrations.filter(function (registration) {
      return pageUrl.startsWith(registration.scope) && [registration.installing, registration.waiting, registration.active]
        .filter(Boolean).some(function (worker) { return new URL(worker.scriptURL).pathname.endsWith("/service-worker.js"); });
    });
    var results = await Promise.all(matching.map(function (registration) { return registration.unregister(); }));
    sessionStorage.setItem("gridlySwDiagnosticUnregistered", "true");
    sessionStorage.setItem("gridlySwDiagnosticUnregisterCount", String(results.filter(Boolean).length));
    location.reload();
  });

  navigator.serviceWorker?.addEventListener("controllerchange", function () {
    lifecycleEvents.push(milliseconds(performance.now()) + " controllerchange");
    renderState();
  });
  navigator.serviceWorker?.getRegistration().then(observeRegistration);
  addEventListener("load", function () { renderState(); });
}());
