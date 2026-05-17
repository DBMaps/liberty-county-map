# Gridly V142.0 Forced Reflow Audit

## Executive Summary

This audit found heavy layout measurement activity (`getBoundingClientRect`, `getComputedStyle`, `client/scroll` metrics) across portrait V2 sheet state, route/report surfaces, map resizing, and diagnostic helpers. The most likely forced reflow warnings are produced by interaction paths where class/style/attribute writes are followed in the same tick (or immediate follow-up frame) by geometry/computed-style reads. No behavior changes were implemented in this audit.

## Layout Reads Found

Primary read APIs found in `js/app.js`:

- `getBoundingClientRect()` (frequent)
- `getComputedStyle()` (frequent)
- `clientWidth`, `clientHeight`
- `scrollWidth`, `scrollHeight`
- `getClientRects()`

Observed concentration areas:

- Portrait V2 sheet visibility and diagnostics
- Route/hazard panel state checks
- Popup/map sizing and positioning
- Dock/filter control verification
- Mobile/desktop layout mode synchronization

## Layout Writes Found

Primary write APIs/patterns found in `js/app.js`:

- `classList.add/remove/toggle`
- `style.*` inline writes (`display`, `pointerEvents`, `transform`, etc.)
- `setAttribute()` / `removeAttribute()`
- `innerHTML` replacement
- `appendChild()`

Observed concentration areas:

- Portrait V2 sheet/backdrop open/close lifecycle
- Mobile route quick panel and hazard panel transitions
- Modal open/close and accessibility attribute updates
- Dynamic panel/surface mounting

## Suspected Read-After-Write Patterns

Potential forced reflow candidates:

1. **Portrait V2 sheet lifecycle**
   - Writes: sheet/backdrop classes and inline styles during open/close.
   - Reads: subsequent visibility and bounds checks (`getComputedStyle`, `getBoundingClientRect`) in nearby state/audit flows.

2. **Route Setup / Route Quick panel transitions**
   - Writes: visibility class toggles and aria/hidden attributes.
   - Reads: immediate style/rect verification in route state/debug paths.

3. **Map resize / invalidateSize path**
   - Writes: container mode/state changes and control relocation.
   - Reads: map/control dimensions around `requestAnimationFrame` + `map.invalidateSize()` scheduling.

4. **Alerts/report refresh rendering chain**
   - Writes: panel DOM/class updates from render routines.
   - Reads: downstream checks for visibility/geometry in shared surface state helpers.

## Hotspot Functions

Most likely hotspots (by usage pattern and area):

- `applyPortraitV2SurfaceContainment`
- `renderAlerts()`
- `renderUnifiedIncidents()`
- `refreshReportHazardViews()`
- `installGridlyMobileLayerMenu`
- `scheduleMapResize`
- `gridlyPortraitV2SheetState`
- `gridlyPortraitV2LayerAudit`

## Repeated Trigger Sources

Repeated trigger sources likely amplifying reflow warnings:

- Multiple `window.resize` listeners
- `visualViewport.resize` and `visualViewport.scroll` listeners
- `requestAnimationFrame` chains for map sizing
- `setTimeout`-driven staged UI transitions
- `setInterval` live refresh loop (`loadSharedReports`)

## Low Risk Targets

Low-risk V142.1 optimization targets (not implemented in this audit):

- Batch DOM writes, then perform a single read phase per frame.
- De-duplicate resize-triggered measurement handlers.
- Gate map `invalidateSize()` to real dimension changes.
- Move non-essential diagnostics out of hot interaction paths.
- Cache stable measurements during transition windows.

## High Risk Areas To Avoid

Avoid invasive changes in protected behavior areas:

- Supabase sync / report persistence
- FRA crossing loading
- Liberty County GeoJSON loading
- Routing engine and Route Watch calculations
- Saved places logic
- Refresh ownership chain
- Desktop and landscape tactical architecture

## Recommended V142.1 Scope

Recommended bounded scope for V142.1 (implementation deferred):

1. Add non-invasive instrumentation to timestamp write/read sequences in:
   - Portrait V2 sheet open/close
   - Route quick panel open/close
   - Map resize/invalidate path

2. Consolidate resize listeners into one scheduler for read/write phasing.

3. Introduce frame-phase discipline:
   - Phase A: all class/style/attribute writes
   - Phase B: all `getBoundingClientRect`/`getComputedStyle` reads

4. Keep all route logic, reporting behavior, persistence, and ownership chain unchanged.

No V142.1 optimization was implemented in this deliverable.
