# Gridly V942 Continuous Work and Scheduler Inventory

Scope: analysis-only inventory of scheduler, listener, observer, polling, realtime, delayed-render, and global-wrapper mechanisms that can keep Gridly doing work after startup, during map interaction, and after report submission. Runtime code was not modified.

## Static validation commands used

- `find .. -name AGENTS.md -print -exec cat {} \;`
- `rg -n "requestAnimationFrame|cancelAnimationFrame|setTimeout|clearTimeout|setInterval|clearInterval|requestIdleCallback|cancelIdleCallback|MutationObserver|ResizeObserver|IntersectionObserver|PerformanceObserver|addEventListener|removeEventListener|map\.on|map\.off|move|moveend|zoom|zoomend|resize|scroll|touchstart|touchmove|pointerdown|pointermove|realtime|WebSocket|Supabase|polling|retry|auto-refresh|scheduleHazardMarkerAutoRender|shared-report|gridlyEndToEndPerformanceAudit" .`
- `rg -n "function (scheduleHazardMarkerAutoRender|scheduleUnified|.*Delayed|loadSharedReports|renderCrossings|openCrossingPopupFromMarkerInteraction|scheduleRenderCrossings|renderGridlyCommunityPulse|gridlyBackgroundLoopAudit|gridlyV926ArmCollectors|gridlyV926StopCollectors)|setInterval\(|supabase\.channel|channel\(" js/app.js`

## Automatically active schedulers and observers

| Mechanism | Source | Function | Started by | Repeats / delay | Stops | Duplicate risk | Work performed | Production auto-active | Main-thread / invalidation risk |
|---|---|---|---|---|---|---|---|---|---|
| Initial shell release double frame and timeout | `index.html:47-64` | `scheduleRelease` | Inline script during document load | Two `requestAnimationFrame` callbacks then `setTimeout(..., 180)`; fallback `setTimeout(..., 1400)` | One-shot; DOMContentLoaded listener uses `{ once: true }` | Low | Releases startup shell class/state | Yes | Low after startup; contributes deferred startup work only |
| Background timer/RAF tracking wrappers | `js/app.js:6139-6208` | `installGridlyBackgroundTimerTracking` | Top-level call during app script evaluation | Wraps every future `setInterval`, `setTimeout`, `requestAnimationFrame`; no own loop | Never restored in normal runtime | Guarded by `window.__gridlyBackgroundLoopTrackingInstalled` | Tracks active timers/frames and wraps timeout/RAF callbacks to remove audit records | Yes | Wrapper overhead on every timer/frame; can appear in stacks, but callback owns expensive work |
| V919/V920 end-to-end audit wrappers | `js/gridlyEndToEndPerformanceAudit.js:188-237` | `installInstrumentation` | Top-level module installation in `gridlyEndToEndPerformanceAudit.js` | Wraps `fetch`, `EventTarget.addEventListener`, `removeEventListener`, `setInterval`, `setTimeout`, `requestAnimationFrame`; adds capture `pointerdown` listener that schedules one RAF | No restore path found | No install guard in the wrapper block; reload/script re-execution can wrap again | Records network/timer/listener metadata; hidden polling callbacks with matching names can be skipped | Yes, because script is loaded by `index.html` | Medium: global wrappers add synchronous bookkeeping to every listener/timer/fetch; wrapper visibility is not proof callback is expensive |
| V919 long-task observer | `js/gridlyEndToEndPerformanceAudit.js:140-148` | `observeLongTasks` | Audit module initialization | Passive `PerformanceObserver` for `longtask` | No disconnect retained | Guarded by `state.longTaskObserverStarted` | Pushes enriched long-task entries | Yes if observer supported | Low-to-medium bookkeeping; does not create long tasks itself |
| V919 pointer visual acknowledgement | `js/gridlyEndToEndPerformanceAudit.js:232-237` | anonymous capture listener | Audit instrumentation install | Per pointerdown, schedules one RAF | Listener not removed | Can duplicate if instrumentation installed more than once | Marks pointerdown-to-visual-ack timing | Yes | Low per interaction; may add RAF entries to stacks |
| DOMContentLoaded app bootstrap | `js/app.js:35132-35187` | anonymous async DOMContentLoaded handler | Browser DOMContentLoaded | One-shot async chain; registers interval | DOMContentLoaded is one-shot | Low unless script loaded twice | Initializes map, Supabase, events, loads crossings/roadways/shared reports, initial desktop pulse/preview, starts live refresh interval | Yes | High during startup due to sequential initialization and render/load chain |
| Shared-report interval refresh | `js/app.js:35178-35186` | anonymous interval callback | DOMContentLoaded bootstrap | Repeats every `LIVE_REFRESH_MS` | No `clearInterval` found | If bootstrap runs more than once, duplicate intervals can exist | Skips while `document.hidden`; otherwise calls `loadSharedReports("interval_live_refresh")` | Yes | High candidate: each tick may fetch, normalize, render hazards/unified incidents, schedule delayed renders |
| Supabase realtime channel | `js/app.js:35712-35738` | `initSupabase` | DOMContentLoaded bootstrap | Supabase client manages subscription/reconnect; on every postgres change calls loader | No unsubscribe/removeChannel found | If `initSupabase` called more than once, duplicate channels/listeners can exist | `postgres_changes` event on `reports` triggers `loadSharedReports("realtime_postgres_change")` | Yes when Supabase library loads | Medium-to-high: changes can trigger full shared-report refresh/render chain; reconnect behavior is in Supabase library, not app code |
| Shared-report loader deferred unified renders | `js/app.js:44883-45048` | `loadSharedReports` | Initial bootstrap, interval, realtime, post-submit, manual/audit calls | Not self-recursive; schedules multiple one-shot delayed renders at 250, 1000, 2000 ms on desktop plus calls `scheduleHazardMarkerAutoRender` | In-flight promise/dedupe suppresses overlapping loads; individual delayed timeouts are not cancelled | Multiple loader invocations can queue multiple delayed render sets | Reads Supabase reports, normalizes/filter/merges local reports, history capture, renders unified incidents, refreshes hazard views, schedules hazard marker auto renders, updates sync text | Yes | Very high candidate: combines network completion with synchronous normalization, DOM/map render work, and delayed render retries |
| Crossing map terminal event RAF | `js/app.js:39520-39550` | map `zoomend moveend` listener | `initMap` | Per moveend/zoomend, cancels previous frame and schedules one RAF | Cancels only pending `__gridlyV920MapMoveFrame`; listener not removed | Map initialized once normally; duplicate init would duplicate listener | Records movement checkpoint; suppresses during popup guard or schedules `scheduleRenderCrossings("map-move-or-zoom")` | Yes | Medium-to-high during map interaction; coalesced to terminal events but still can render markers |
| Base layer and popup map listeners | `js/app.js:39411-39415`, `js/app.js:39491-39496`, `js/app.js:40232-40233` | `initMap`/mobile layer menu listeners | Map initialization / menu installation | Event-driven | Not removed | Duplicate if installers re-run | Popup open/close schedules RAF to sync mobile destination card; base layer changes mutate classes/state; document pointerdown closes menu | Yes | Low-to-medium; popup RAF matters in crossing chain |
| Crossing render scheduler | `js/app.js:45530-45582` | `scheduleRenderCrossings` | Map move/zoom, load/state changes, manual/audit calls | One RAF; coalesces while `crossingRenderFrameHandle` is active | No external cancel except handle reset after execution | Coalesced, but separate reasons accumulate | Calls `renderCrossings` after guard checks | Yes | Medium-to-high when it calls render; itself is coalescing |
| Crossing marker batched rendering | `js/app.js:45584-46137` | `renderCrossings` | Scheduler, direct calls, startup/audit | Uses `gridlyV921ScheduleBatches` for missing markers (batchSize 8, timeBudget 12 ms) | Generation checks cancel stale batches | Re-render can create new marker DOM/listeners for new/replaced markers | Filters inventory by bounds/policy, creates Leaflet markers/popups/icons, attaches listeners, mutates marker layer | Yes | High if many crossings need creation/replacement; less when signatures skip or markers reused |
| Crossing marker click/touch listeners | `js/app.js:45888-46013`, `js/app.js:24443-24495` | marker click/popup listeners and `wireCrossingMarkerEarlyTapOpen` | Marker creation in `renderCrossings` | Event-driven; touch/pointer handlers per marker | Marker removal removes DOM with marker; no explicit listener cleanup | Guards (`__gridlyCrossingClickBound`, `__gridlyEarlyTapOpenBound`, DOM fallback flag) apply per marker instance; marker replacement creates new listeners | Opens popup, tracks popup lifecycle, syncs command card, wires popup buttons, schedules deferred render after popup close | Yes | Medium; many listeners can exist proportional to markers; callback can trigger pan/timers/RAF |
| Crossing popup open verification / reposition timers | `js/app.js:24100-24147`, `js/app.js:24172-24432` | `openCrossingPopupFromMarkerInteraction` and verification closure | Marker click/pointer/touch | One RAF + zero-delay timeout to verify; if not visible, `moveend` once plus 90/220 ms retry; safe-zone pan fallback 320/340 ms | `cancelPendingCrossingPopup` clears active session timers when replacing/closing | One session active; duplicate clicks suppressed | Updates selection visual, may pan map, opens popup, verifies visibility, records traces | Yes, during crossing click | Medium-to-high for the interaction; can trigger Leaflet pan/moveend and render suppression logic |
| Hazard marker auto render retries | `js/app.js:59656-59668` | `scheduleHazardMarkerAutoRender` | `loadSharedReports`, local hazard/report paths | Immediate render, then 500 ms and 1500 ms timeouts | Not cancelled | Yes: every call queues two delayed retries | Calls `renderUnifiedIncidents` or fallback marker renderer | Yes | High after report refresh/submit because repeated calls can stack and each callback renders markers |
| V926 simulation collectors | `js/app.js:99594-99664` | `gridlyV926ArmCollectors` / `gridlyV926StopCollectors` | Explicit simulation/audit only | Starts `PerformanceObserver`; wraps `window.gridlyV920MeasureFunction`; await loops later use RAF/timeouts | `gridlyV926StopCollectors` disconnects observer and restores measure function | If armed repeatedly before stop, previous observer may be overwritten | Captures measurements and long tasks | Explicit diagnostics only | Low in normal use; medium during diagnostics |
| V926 simulation wait loops | `js/app.js:99665-99680` | `gridlyV926AwaitProductionCompletion` | Explicit performance simulation | Repeats RAF or 16 ms timeout until stable or 480 ms | Loop exits by time/stability | Explicit-only | Waits for active generations/marker IDs to stabilize | No, diagnostics only | Medium during simulation; should stop on completion |
| Directional awareness delayed apply | `js/gridlyDirectionalAwarenessLayer.js:176-182` | module tail | Script load | DOMContentLoaded one-shot plus zero-delay timeout | One-shot | Possible if script loaded twice | Applies directional awareness cards | Yes if script included | Low |
| Runtime source bridge warmup | `js/gridlyRuntimeSourceBridgeActivation.js:280-287` | module tail | Script load | One zero-delay timeout | One-shot | Possible if script loaded twice | Calls `activate("Liberty")` async warmup | Yes if script included | Low-to-medium startup/network only |
| Provider fetch timeout controllers | `js/gridlyDriveTexasLiveConnector.js:70-74`, `js/gridlyWeatherLiveConnector.js:64-68` | `createTimeoutController` | Connector `fetchNow` calls | One timeout per fetch; timeout aborts request | Cleared in connector finally blocks | Per fetch only | Abort slow provider requests | Only when connector fetches are invoked | Low CPU; network timeout management |

## Globally wrapped browser APIs

1. `js/app.js` installs production-loaded background tracking wrappers for `window.setInterval`, `window.clearInterval`, `window.setTimeout`, `window.clearTimeout`, `window.requestAnimationFrame`, and `window.cancelAnimationFrame`. Installation is guarded by `window.__gridlyBackgroundLoopTrackingInstalled`, but native functions are not restored during normal use.
2. `js/gridlyEndToEndPerformanceAudit.js` installs wrappers for `globalScope.fetch`, `EventTarget.prototype.addEventListener`, `EventTarget.prototype.removeEventListener`, `globalScope.setInterval`, `globalScope.setTimeout`, and `globalScope.requestAnimationFrame`. No restore path or install guard is visible in that wrapper block.
3. V926 explicit diagnostics can temporarily replace `window.gridlyV920MeasureFunction`; `gridlyV926StopCollectors` restores or deletes it. This does not wrap native browser APIs.

## V919 investigation findings

- `gridlyEndToEndPerformanceAudit.js` does automatically replace `window.setTimeout`, `window.setInterval`, and `window.requestAnimationFrame` when the module runs, because the wrapper loop assigns `globalScope[name] = function gridlyV919TimerWrapper(...)` for those names.
- It does not wrap `cancelAnimationFrame`, `clearTimeout`, or `clearInterval`.
- It automatically replaces `window.fetch` when `globalScope.fetch` exists.
- Replacements occur during script evaluation before `globalScope.gridlyEndToEndPerformanceAudit` is exported.
- They remain installed during normal app use; no native restoration is present.
- They remain installed after `runPerformanceSimulation` completes; simulation completion only populates results.
- The wrapper block can be installed more than once if the script is evaluated more than once, because no sentinel guard is visible around `installInstrumentation`'s assignments.
- Wrapped timer callbacks add synchronous hidden-tab accounting before calling the original handler; wrapped fetch callbacks add request bookkeeping and timing promise continuations; wrapped event-listener registration adds lifecycle bookkeeping on registration/removal, not on every event dispatch.
- The simulation schedules one zero-delay timeout between each scenario iteration and scenario-specific timeouts/RAF/map events. These are bounded by the requested iterations and do not appear to leave a recurring loop after completion.

## Schedulers/listeners that can be installed more than once

- V919 global wrappers can stack if the audit script is evaluated more than once.
- The shared-report interval can duplicate if the DOMContentLoaded bootstrap executes more than once.
- Supabase realtime channel subscription can duplicate if `initSupabase` runs more than once; no unsubscribe path was found.
- Leaflet map listeners in `initMap` can duplicate if `initMap` is called again on the same page lifecycle.
- Marker listeners are guarded on each marker instance, but marker replacement creates fresh marker DOM and fresh listeners.
- Popup DOM button wiring occurs on popup open for the current popup element; repeated popup DOM recreation can rewire fresh elements.

## Recursive or self-rescheduling callbacks

- No unbounded direct recursive `setTimeout(fn)` loop was found in the main app paths reviewed.
- `loadSharedReports` is not self-recursive, but it schedules multiple delayed `renderUnifiedIncidents` retries on each invocation.
- `scheduleHazardMarkerAutoRender` is not recursive, but every invocation immediately renders and schedules two more renders.
- `scheduleRenderCrossings` coalesces to one RAF and calls `renderCrossings`; it does not reschedule itself unless external map/data events keep firing.
- V926 explicit simulation waits use repeated RAF/timeouts inside a bounded `while` loop ending on stability or 480 ms.

## Delayed marker and unified-incident render retries

- `loadSharedReports` calls `renderUnifiedIncidents("auto-active-hazards-populated")` immediately, then desktop delayed retries at 250 ms and 1000 ms.
- The same loader calls `refreshReportHazardViews`, `scheduleHazardMarkerAutoRender`, then `renderUnifiedIncidents("auto-shared-reports-loaded")` and `renderUnifiedIncidents("auto-hazards-refreshed")` immediately, plus desktop delayed retries at 250 ms, 1000 ms, and 2000 ms.
- `scheduleHazardMarkerAutoRender` adds another immediate render plus 500 ms and 1500 ms delayed renders.
- Therefore one successful desktop `loadSharedReports` can perform multiple immediate unified/hazard renders and queue up to seven delayed render callbacks, excluding work inside `refreshReportHazardViews`.

## Crossing marker open execution and scheduling chain

1. Marker creation in `renderCrossings` builds the Leaflet marker, binds popup content, adds it to the crossing layer, then attaches Leaflet click, DOM fallback click, popupopen, popupclose, and early pointer/touch listeners.
2. Pointer/touch path: `wireCrossingMarkerEarlyTapOpen` records `pointerdown`/`touchstart`, tracks `pointermove`/`touchmove`, and on qualifying `pointerup`/`touchend` suppresses the native click for 520 ms and calls `openCrossingPopupFromMarkerInteraction`.
3. Click path: marker `click` stops/prevents original event, checks tap retargeting and duplicate guards, records the click, then calls `openCrossingPopupFromMarkerInteraction`.
4. `openCrossingPopupFromMarkerInteraction` updates selected marker visuals in place, cancels the previous pending popup session, creates a new session, syncs the mobile destination card, measures marker/viewport geometry, and either opens directly or pans the map first.
5. If direct open is possible, it calls `finalizeOpenCrossingPopup` synchronously through `openDirectlyOnClick`.
6. If safe-zone repositioning is needed, it registers a one-time `moveend` callback, schedules a 320/340 ms fallback timeout, calls `map.panBy(..., { animate: true })`, and opens after moveend or timeout.
7. The completion/verification path schedules a `requestAnimationFrame` and then `setTimeout(..., 0)` to verify popup visibility. If not visible, it can arm one more `moveend` retry plus 90/220 ms timeout.
8. Leaflet `popupopen` fires marker listener work: updates selected marker, computes popup CSS/metrics, toggles `document.body` class, syncs mobile destination card, records trace, and wires popup report buttons.
9. Map-level `popupopen popupclose` listener also schedules an RAF to sync the mobile destination command card.
10. Map `moveend/zoomend` caused by safe-zone panning reaches the map terminal listener. During popup suppression it generally records/suppresses crossing rerender; if not suppressed and intentional, it cancels any pending map RAF and schedules `scheduleRenderCrossings("map-move-or-zoom")`.
11. On `popupclose`, the marker listener can schedule one RAF to call `scheduleRenderCrossings` for any deferred crossing render reason.
12. First browser paint after popup visibility is therefore behind any synchronous marker click/open work, optional Leaflet pan animation work, popupopen DOM/class/metric/button work, the audit pointerdown RAF, and the map popupopen RAF.

## Top three credible causes of persistent main-thread activity, ranked by evidence

### 1. Shared-report refresh chain plus delayed unified/hazard render retries

Source: `loadSharedReports` and `scheduleHazardMarkerAutoRender`.

Evidence: the automatic interval and realtime channel feed `loadSharedReports`; a successful loader performs Supabase reads, normalizes and filters reports, merges local accepted reports, captures history, renders unified incidents immediately several times, refreshes hazard views, and schedules delayed render retries. Each invocation can create another delayed-render cluster.

Why it explains observations: it can keep reintroducing map/DOM render work after startup and after report submission; the delayed retries can overlap with user interaction and Leaflet popup work; the V919 wrapper will show timer/RAF frames even though the expensive CPU is inside render callbacks.

Smallest safe isolation/correction for next branch: add a feature-flagged or dev-only isolation that disables only delayed duplicate unified/hazard render retries after a successful immediate render, while preserving the data load and one visible render; separately coalesce post-load render reasons into a single scheduled render per refresh generation.

### 2. Production-loaded global timer/RAF/fetch/listener wrappers

Source: `installGridlyBackgroundTimerTracking` and `gridlyEndToEndPerformanceAudit.js` instrumentation.

Evidence: two independent wrapper systems are loaded automatically. The app wrapper is guarded but never restored; V919 wraps timers/RAF/fetch/listener registration without an install sentinel and is loaded by `index.html`.

Why it explains observations: wrappers can make stack traces point at timer/RAF wrappers, add synchronous bookkeeping to every timer/fetch/listener registration, and may stack if scripts reload. They are unlikely alone to create 7-second CPU work, but they can amplify timer-heavy render paths and obscure attribution.

Smallest safe isolation/correction for next branch: gate end-to-end audit instrumentation behind an explicit diagnostic flag, keep native API restoration handles, and add an idempotent sentinel. Do not remove production app behavior while isolating.

### 3. Crossing popup interaction combined with map pan/moveend/render scheduling and marker batch rendering

Source: crossing marker listeners, `openCrossingPopupFromMarkerInteraction`, map `moveend/zoomend` handler, and `renderCrossings`.

Evidence: a crossing click can perform selected-marker DOM updates, layout reads, optional animated `panBy`, `moveend` one-shot callbacks, fallback timers, RAF+timeout verification, popupopen DOM/class/metric/button work, and map-level RAF sync. The map terminal handler can schedule crossing rendering when not suppressed, and marker rendering can batch-create Leaflet markers/listeners/images.

Why it explains observations: the reported crossing marker click handler and RAF delays align with this path. However, the code contains popup suppression guards and coalescing, so the likely expensive unit is marker/render work triggered around the interaction, not the wrapper frame alone.

Smallest safe isolation/correction for next branch: add a safe branch that opens the popup without safe-zone pan and without any crossing rerender until after the first paint, then compare interaction timing; if validated, defer non-visible popup audit/metric work and keep marker diffing outside the tap frame.

## Clear recommendation for next branch

Create a runtime-code branch focused on isolation, not optimization: first gate V919 global instrumentation behind an explicit diagnostic query/local flag with native restoration and idempotence; second coalesce `loadSharedReports` render outputs into one generation and remove redundant delayed render retries behind a reversible flag; third run a crossing-popup isolation that prevents popup-triggered pan/rerender work until after first paint. This order separates wrapper attribution from actual CPU work and targets the only automatically repeating production work found: live shared-report refresh/realtime plus delayed render clusters.
