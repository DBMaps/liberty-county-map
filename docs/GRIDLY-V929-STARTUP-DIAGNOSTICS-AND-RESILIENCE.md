# GRIDLY V929 — Startup Diagnostics and Resilience

## 1. Executive summary
V929 adds a lightweight structured startup trace, audit helpers, validation helpers, and conservative fail-safe handling around the current Gridly startup sequence. It does not redesign startup and does not change protected product systems.

## 2. Observed startup problem
Gridly has shown intermittent startup delays or apparent freezes across multiple branches. V929 does not prove a single root cause; it adds evidence capture so the active, completed, failed, or timed-out startup stage can be identified from the browser console.

## 3. Investigation scope
Reviewed `index.html`, `js/app.js`, `service-worker.js`, Supabase initialization, map initialization, crossing/package loading, roadway loading, report/incident loading, awareness restoration/profile hydration, marker rendering through `loadCrossings()`, and startup awaits in the main DOMContentLoaded handler.

## 4. Actual startup sequence discovered
The primary startup path is the async `DOMContentLoaded` handler in `js/app.js`: local state/UI hydration, awareness/profile restoration, map initialization, Supabase client/realtime setup, event binding, saved preferences/routes, crossing loading and marker rendering, roadway dataset loading, initial Supabase reports read, and initial desktop Community Pulse/awareness preview rendering.

## 5. Blocking versus nonblocking stages
Blocking stages: DOMContentLoaded bootstrap, map initialization, crossing package loading and initial marker rendering. Nonblocking/degradable stages: Supabase initialization, roadway dataset loading, initial report/incident loading, and desktop awareness preview rendering.

## 6. Network dependencies reviewed
Startup network dependencies include crossing package/FRA data, roadway data, Supabase report reads, tile requests initiated by Leaflet, and app shell files managed by the service worker. V929 bounds startup waits for crossings, roadway data, and initial Supabase report loading without introducing duplicate requests.

## 7. Service-worker findings
The service worker uses cache cleanup on activate and network-first handling for navigations and known shell assets. No evidence was found that it intentionally blocks navigation indefinitely. V929 updates the shell cache name and includes the diagnostics script in the shell cache so stale app shell versions are less likely to mask this branch's startup instrumentation.

## 8. Root cause findings, if proven
No root cause is proven by code inspection alone. Possible contributors now measurable include slow or unresolved crossing/report/roadway network dependencies, browser/service-worker cache state, third-party CDN loading before `app.js`, and runtime exceptions during startup.

## 9. Instrumentation added
`window.gridlyStartupAudit?.()` returns the stable V929 audit object. `window.gridlyStartupSummary?.()` returns a concise status summary. Each stage records status, timings, duration, blocking/nonblocking classification, network/dependency details, timeout thresholds, failures, and fallback/degraded flags.

## 10. Timeout and watchdog design
The watchdog threshold is 30 seconds to avoid false failures during ordinary loading while still recording apparent freezes. Startup wait bounds are conservative: 20 seconds for crossing/initial marker work, 12 seconds for roadway data, and 15 seconds for initial Supabase reports. Timeouts record degraded startup and allow continuation where safe.

## 11. Degraded startup behavior
When noncritical dependencies time out or fail, startup diagnostics record degraded mode and the app continues with available information. A restrained existing-status message may appear after the watchdog confirms a delayed startup.

## 12. Files changed
- `index.html`
- `js/app.js`
- `js/gridlyStartupDiagnostics.js`
- `service-worker.js`
- `docs/GRIDLY-V929-STARTUP-DIAGNOSTICS-AND-RESILIENCE.md`

## 13. Validation performed
Static syntax validation was run with Node's parser. Browser validation should run the helpers listed in the final response after loading the app.

## 14. Protected systems confirmation
V929 does not intentionally change historical reads/UI flags, DriveTexas/transportation intelligence flags, reporting semantics, report ownership, incident eligibility, crossing popup behavior, route-watch behavior, Community Pulse ownership, Awareness Brief ownership, county gating, consumer-facing safety language, or V928 behavior.

## 15. Remaining observations
The audit can distinguish slow startup from confirmed exceptions only after runtime evidence exists. CDN script loading before `app.js` is outside the in-app trace except for the early diagnostics script loaded before Leaflet/Supabase.

## 16. Final recommendation
PASS WITH OBSERVATIONS: instrumentation and fail-safe bounds are in place; browser-console validation should be used on affected devices to identify the actual runtime stall.
