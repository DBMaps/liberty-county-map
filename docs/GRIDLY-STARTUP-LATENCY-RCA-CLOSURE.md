# Gridly service-worker / browser navigation lifecycle RCA

## 1. Incident and quick summary

**OPEN — INTERMITTENT DEVELOPMENT/BROWSER NAVIGATION DELAY AFFECTING GRIDLY
USABILITY.** The narrower finding `GRIDLY_APPLICATION_OWNERSHIP_NOT_SUPPORTED`
remains valid. Static analysis proves that the service worker can intercept every
same-origin navigation in its `./` scope, including the tiny control page. The
observed `workerStart` immediately before `fetchStart` is therefore consistent
with a controlled navigation waiting for worker startup/dispatch before its
network fetch. It does not identify what consumed the preceding 8.26 seconds and
does not prove a service-worker-owned defect.

This RCA adds a development-only, button-driven control. It changes no production
registration, worker, application runtime, script order, or protected subsystem.

## 2. Service-worker registration flow and inventory

Production has three registration calls:

* `js/app.js` registers `./service-worker.js` with scope `./` from a `load`
  listener. Registration therefore begins only after the Gridly document and its
  load-blocking resources complete. The options omit `updateViaCache`, so the
  browser/API default (`imports`) applies. The app observes `updatefound` and an
  installing worker's state; it shows an update notice when an installed worker
  exists alongside a controller. It sends version and explicit skip-waiting
  messages. It does not call `registration.update()` or unregister.
* `beta-closure.html` and its matching `beta-closed.html` surface each register
  the same script and scope during their inline closure cleanup flow (not a
  `load` listener). Neither changes `updateViaCache` nor unregisters the worker.

The 3,673-byte worker has no imports and only declares two URL arrays, one cache
predicate, and four event handlers at top level. Its handlers are:

| Event | Work |
| --- | --- |
| `install` | Opens one cache; `addAll` fetches 11 shell URLs; calls `skipWaiting()` after success **or failure**. |
| `activate` | Enumerates all cache names, deletes recognized old `gridly-pwa-shell-*` and `gridly-beta-closure-*` caches in parallel, then calls `clients.claim()`. |
| `fetch` | Intercepts eligible same-origin GET navigations and selected static assets. |
| `message` | Reports version/cache name or honors explicit `GRIDLY_SKIP_WAITING`. |

There are no sync, periodic-sync, background-fetch, push, notification-click, or
other background handlers. Navigation preload is neither enabled nor consumed.

## 3. Fetch behavior and navigation interception

For every same-origin GET whose request mode is `navigate`, the worker calls
`respondWith()`. It immediately starts a network-first `fetch(request, {
cache: "no-store" })`. A successful response is returned without waiting for
the asynchronous cache open/write of a clone to `./index.html`. On network
rejection it awaits `caches.match("./index.html")` as an offline fallback. There
is no stale-while-revalidate path and no cache read on the successful online
path. Because fallback is always stored/read under `./index.html`, an offline
navigation to the diagnostic page may synthesize the cached Gridly index rather
than that page.

Selected shell and runtime-county-geometry GETs are cache-first, with an
unawaited successful network-response write. Cross-origin and other same-origin
requests are not intercepted. Thus the worker **can and does control navigation
requests**, even though its normal online navigation branch goes directly to the
network.

## 4. Registration and control-state map

| State | Meaning / observable diagnostic signal |
| --- | --- |
| No registration | No matching registration, no controller. |
| Registered but uncontrolled | Registration exists; controller is absent. This can occur before first claim/control or after explicit diagnostic unregister until reload semantics settle. |
| Registered + waiting | `registration.waiting` identifies an installed update awaiting activation. Current install normally calls `skipWaiting`, so this should be transitional unless lifecycle/browser conditions prevent immediate activation. |
| Active but uncontrolled | `registration.active` exists but `navigator.serviceWorker.controller` is absent, commonly on a first navigation before claim completes. |
| Controlled | Controller script/state is visible; scoped navigation is dispatched through the worker fetch handler. |
| Updated worker available | `installing`/`waiting`, `updatefound`, and worker state transitions expose this after the page is delivered. |
| Controller change | `controllerchange` is timestamped relative to the document's performance time origin. |

`skipWaiting()` plus `clients.claim()` makes first-control and update transitions
aggressive. The repository does not contain evidence that the incident coincides
with first control, activation, controller change, update, registration refresh,
or worker restart. The new control records state and transitions for owner
evidence; a single screenshot can distinguish these cases after delivery.

## 5. Update-check finding

Normal Gridly registration may cause the browser's service-worker registration
update algorithm to run, subject to browser update throttling/caching policy.
Because this call occurs in the newly loaded page's `load` handler, that call
cannot itself explain the same document's pre-`fetchStart` interval. An already
registered worker and browser-managed update/start behavior can still participate
in a later controlled navigation, but the repository cannot prove that it did.

The web API exposes installing/waiting/active workers, script URLs, states,
`updateViaCache`, `updatefound`, `statechange`, and `controllerchange`. It does not
expose the last-update-check timestamp, the start/end of a browser-internal
update check, DevTools “Update on reload”, or bypass-for-network state. The
control deliberately does not call `registration.update()`, which would mutate
the observed lifecycle.

## 6. Cache Storage and worker-cost finding

The static worker knows one current cache and recognizes prior Gridly shell and
beta-closure cache names for deletion. Installation can perform 11 network/cache
writes. Activation performs one `caches.keys()` traversal and parallel deletes
only recognized old caches. It has no `matchAll`, entry traversal, delete-all,
version-migration loop, or activation network request. Message processing is
constant-time. Online navigation does one network request plus a response clone
and asynchronous open/write.

Slow storage/network could make installation or old-cache deletion take seconds,
but no operation has deterministic CPU work plausibly accounting for eight
seconds. The control reports all origin cache names and entry counts without
opening response bodies; the Cache API exposes no aggregate byte count, and
reading every response merely to estimate bytes would distort this diagnostic.
It never clears caches automatically or from its explicit unregister action.

## 7. Navigation preload

The worker never calls `navigationPreload.enable()` and never reads
`event.preloadResponse`; owner evidence that it is disabled matches the code.
Preload could theoretically overlap network work with worker startup because the
worker intercepts navigations, but enabling it is an unproven production behavior
change and is not justified during this RCA.

## 8. `workerStart` interpretation

For Navigation Timing, nonzero `workerStart` reports the time immediately before
dispatching the fetch event to the relevant service worker. It is zero when no
service worker is involved. It is not an update-check timestamp. Consequently,
`workerStart = 8260.6 ms` and `fetchStart = 8261.7 ms` supports this narrow reading:
the controlled navigation reached worker fetch dispatch, then its network fetch
began about 1.1 ms later. The worker's synchronous navigation branch between
those markers is tiny.

The values do **not** attribute the preceding 8.26 seconds. That interval may
include browser scheduling or worker startup before fetch-event dispatch; the
Navigation Timing entry alone cannot partition it. The correlation remains the
strongest lead, not proof of `SERVICE_WORKER_STARTUP_DELAY`.

## 9. Edge-specific observability limits

The standards-visible state is captured. Edge process scheduling, worker process
startup, storage partition internals, extension/security/profile interference,
Tracking Prevention decisions, DevTools “Update on reload”, and bypass-for-network
state are not exposed to page JavaScript. This repository environment also has
no affected owner Edge profile, so none can be classified causal. No DevTools
setting should be changed for the owner test.

## 10. Tracking Prevention correlation

The production document references Leaflet CSS/JS from `unpkg.com` and Supabase
JS from `cdn.jsdelivr.net`; these are third-party origins. The control page
references neither. A console storage-block warning associated with those
resources can only follow document fetch sufficiently for the browser to discover
the resource, so it cannot explain a delay before the document's `fetchStart`.
The existing startup audit can timestamp observed resource/error evidence, but
console wording alone supplies no causal or precise timing relationship. Tracking
Prevention remains enabled and unmodified.

## 11. Owner control and exact test

`startup-navigation-control.html` now shows controller identity, registration
scope/update policy, installing/waiting/active state, navigation/worker/fetch
timings, navigation preload, observed lifecycle transitions, and read-only cache
inventory. It has no production runtime or external dependency. Exact
controlled/uncontrolled isolation within the same scope requires removing the
registration; therefore a localhost-only, explicit temporary unregister control
is available and clearly labeled.

1. Open `http://127.0.0.1:5500/startup-navigation-control.html` and take a screenshot.
2. Click **RELOAD CONTROL PAGE** once and take a screenshot if a delay appears.
3. Click **TEMPORARILY UNREGISTER SERVICE WORKER FOR THIS LOCALHOST TEST**; the page reloads itself uncontrolled.
4. Click **RELOAD CONTROL PAGE** once and take a screenshot.
5. Click **OPEN GRIDLY** to let Gridly register the worker normally again; send the screenshots.

## 12. Root-cause and repair status

**Root cause remains open and intermittent.** Current classifications:

* `GRIDLY_APPLICATION_OWNERSHIP_NOT_SUPPORTED`
* `SERVICE_WORKER_NAVIGATION_INTERCEPTION_PROVEN`
* `SERVICE_WORKER_DELAY_OWNERSHIP_NOT_PROVEN`
* `INTERMITTENT_DEVELOPMENT_BROWSER_NAVIGATION_DELAY_OPEN`

No deterministic `SERVICE_WORKER_STARTUP_DELAY`, `SERVICE_WORKER_UPDATE_DELAY`,
`SERVICE_WORKER_FETCH_INTERCEPTION_DELAY`, or
`SERVICE_WORKER_CACHE_MAINTENANCE_DELAY` has been reproduced. A production repair
is therefore **not justified**. Stop at RCA and collect the controlled versus
explicitly uncontrolled owner evidence; do not merge automatically.
