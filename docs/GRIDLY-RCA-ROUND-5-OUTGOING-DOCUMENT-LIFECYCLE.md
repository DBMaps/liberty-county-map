# Gridly startup/reload latency RCA — round 5

## Scope and supplied timing

This round is attribution only. It does not change script order, application behavior, providers, search, crossings, LP201, or startup scheduling.

The owner control reload reached `fetchStart` in **6.4 ms**. The affected Gridly reload reached `fetchStart` in **37,629.6 ms**; its response ended at 37,677.9 ms and its first resource began 147.1 ms later. The control materially weakens a general Edge, Live Server, localhost, service-worker, emulation, or host-scheduling explanation. The new-document parser cannot own time before its fetch.

## Production lifecycle-handler inventory

Repository-wide static searches of the scripts loaded by `index.html` found the following registrations:

| File / location | Event and handler | Synchronous work | Writes / network / map / provider cleanup |
| --- | --- | --- | --- |
| `index.html:10` | `visibilitychange`, anonymous early evidence handler | Pushes one three-field object to an in-memory array | None |
| `index.html:13` | `pageshow`, anonymous early evidence handler | Pushes one small object | None |
| `index.html:16` | `pagehide`, anonymous early evidence handler | Pushes one small object | None |
| `index.html:207` | `pageshow`, prepaint `release` bridge | On BFCache restore only, toggles startup CSS classes and schedules one RAF | No storage, network, provider, or map work |
| `js/app.js:43924` | `focus`, `reopenResults` on a destination input | Reopens that input's result presentation | No unload ownership; not a window lifecycle handler |
| `js/gridlyStartupDiagnostics.js` | development-only beforeunload, pagehide, visibilitychange, unload, freeze, and resume probes | Appends two tiny timestamp entries and writes one bounded timing record | One bounded `sessionStorage` write per mark; no network, map, provider, or application-state work |

No production registration was found for `beforeunload`, `unload`, `freeze`, `resume`, `blur`, `popstate`, or `hashchange` outside the new localhost-only diagnostic probe. No `window.onbeforeunload`, `window.onunload`, or `document.onvisibilitychange` assignment was found.

## Teardown findings

### Beforeunload and unload

Gridly had no production `beforeunload` or `unload` handler. Consequently there is no lifecycle path containing loops, state serialization, storage persistence, IndexedDB, beacon/fetch/XHR, Supabase unsubscribe, WebSocket closure, map teardown, or large state traversal. The only newly registered handlers are gated to `localhost`/`127.0.0.1`, record timestamps, and do not repair performance.

### Pagehide

The pre-existing pagehide handler performs exactly one array `push`. It does not stringify, traverse DOM/application state, write storage, stop a timer, close a provider, or touch Leaflet. This cannot statically account for a 37-second delay. The development probe performs two bounded timestamp appends and two tiny `sessionStorage` writes so both start and end remain observable if a later lifecycle event never fires.

### Visibilitychange

The pre-existing handler only appends visibility state and a monotonic timestamp. No refresh, persistence, history/awareness/map/crossing capture, or provider shutdown is reachable from it. The development probe adds only bounded timing evidence.

### History capture

All production history-capture scripts were searched for `beforeunload`, `unload`, `pagehide`, and `visibilitychange`. None registers any of those events, so the history-capture stack has no synchronous lifecycle capture path on reload.

### Supabase and WebSocket

No Gridly lifecycle handler calls channel `unsubscribe`, `removeChannel`, client teardown, presence cleanup, or WebSocket close. Supabase's browser runtime may close its transport as the document is destroyed, but Gridly does not explicitly own that operation through a lifecycle registration. The observed “WebSocket is closed before the connection is established” message is therefore not causal evidence by itself.

### Storage

Gridly has ordinary interaction/startup storage calls in `app.js`, but none is reachable from a production unload, pagehide, visibilitychange, or beforeunload handler. The diagnostic record contains only version, prior navigation type/fetchStart, time origin, and at most 24 small event entries. It never serializes application state.

### Timers and RAF

Static inventory finds 131 `setInterval`, `setTimeout`, or `requestAnimationFrame` call sites across production JavaScript. These background and scheduling call sites can occupy the main thread when a reload is requested, but none is synchronously joined or drained by a Gridly teardown handler. A task already executing could explain its measured task duration (the owner's roughly 100–600 ms observations), not an evidenced repeated 37-second lifecycle sequence. Browser capture is still required to exclude one already-running long task at the reload gesture.

### Synchronous network

No production Gridly source contains synchronous `XMLHttpRequest.open(..., false)`, synchronous navigation-time fetch equivalent, or beacon loop. No lifecycle handler performs network work.

## Development-only outgoing-document evidence

On local hosts, `gridlyStartupDiagnostics.js` reads the previous bounded record before starting the current record. It records absolute (`performance.timeOrigin + performance.now`) and relative timestamps for start/end of beforeunload, pagehide, visibilitychange, unload, freeze, and resume. It exposes the prior record as both `window.gridlyPreviousDocumentLifecycle` and `lifecycle.previousDocumentLifecycle` in `window.gridlyStartupLatencyAudit()`.

The diagnostic panel displays current navigation type/pre-fetch delay, the previous Gridly navigation values, and previous lifecycle events. Start/end measure the diagnostic callback's own bounded work; they do **not** claim to bracket the browser's complete event dispatch. This deliberately avoids wrapping application/browser handlers and contaminating the measurement.

## Owner navigate-vs-reload control

Open `startup-navigation-control.html` and click **OPEN GRIDLY**. The Gridly-only development panel appears without console use. It should initially say that previous Gridly evidence is absent; click **RELOAD GRIDLY** in that panel once. The replacement page then shows the current reload pre-fetch delay beside the prior fresh-navigation delay and prior outgoing lifecycle timestamps.

Interpretation:

* Fast control → Gridly plus slow Gridly reload strengthens outgoing-document or already-running-main-thread ownership.
* A lifecycle timestamp ending near the new navigation's delayed `fetchStart` gives correlation, but the exact owner still requires an Edge Performance trace if no Gridly handler spans that interval.
* If lifecycle events are short/absent while `fetchStart` remains late, registered Gridly lifecycle handlers are eliminated; investigate a task already executing when reload is requested or browser navigation internals without relabeling the issue as a general environment delay.

## Root-cause status

**Not proven.** Static audit eliminates explicit Gridly production lifecycle teardown, history capture, Supabase teardown, synchronous storage persistence, and synchronous network as owners. The supplied timing proves only that the gap precedes new-document execution. The new browser evidence is required before attributing the gap to an already-running task or non-Gridly browser lifecycle behavior. No performance repair is authorized or included.
