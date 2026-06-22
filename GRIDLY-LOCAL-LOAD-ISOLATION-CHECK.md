# Gridly Local Load Isolation Check

## Determination

The local server can serve static HTML and project assets. `js/app.js` is syntactically valid under `node --check`, so the freeze is not caused by a static-server failure or JavaScript parse failure.

The load isolation boundary is `js/app.js` runtime execution after `DOMContentLoaded`. The startup path now records each bootstrap function before and after execution so the browser/session can identify the last completed function and the current blocking function even when the tab becomes unresponsive.

## Isolation pages

Run `./isolation/load-isolation-check.sh` from the repository root. It starts a temporary `python3 -m http.server`, requests the isolation pages, requests the production page, requests `js/app.js`, and runs `node --check js/app.js`.

Pages:

1. `isolation/static-smoke.html` — plain static local HTML. Confirms the local server can render static HTML.
2. `isolation/index-app-disabled.html` — copy of `index.html` with only `js/app.js` disabled. Confirms whether the full document and other local startup scripts load without the main Gridly app script.
3. `isolation/index-vendor-only-no-app.html` — copy of `index.html` retaining Leaflet and Supabase scripts while disabling Gridly app/local startup scripts. Confirms whether vendor scripts alone are safe.

## Observed command-line checks

Latest local command output:

```text
200 374 /isolation/static-smoke.html
200 76326 /isolation/index-app-disabled.html
200 74781 /isolation/index-vendor-only-no-app.html
200 76316 /index.html
200 4722495 /js/app.js?v=1714
```

`node --check js/app.js` exits successfully with no syntax errors.

## Startup lock identification

The lock begins after `js/app.js` is loaded and the main `DOMContentLoaded` bootstrap starts. `js/app.js` now exposes:

- `window.GRIDLY_STARTUP_ISOLATION_STATE`
- `window.gridlyStartupIsolationState`
- `sessionStorage.gridlyStartupIsolationLastStep`

If the tab freezes, reopen DevTools or inspect session storage for `gridlyStartupIsolationLastStep`:

- `phase: "before"` without a following `phase: "after"` identifies the blocking startup function.
- `lastCompletedStep` identifies the function that completed immediately before the lock.

The binary-search target list is the ordered main bootstrap in `js/app.js`, beginning at `ensureGridlySearchState` and continuing through `initMap`, `loadCrossings`, `loadRoadwayDataset`, and `loadSharedReports:initial_bootstrap`.

## No scope changes

This check does not change geometry, boundary, or San Jacinto wording. The only application-code change is startup isolation instrumentation around the existing `DOMContentLoaded` sequence.
