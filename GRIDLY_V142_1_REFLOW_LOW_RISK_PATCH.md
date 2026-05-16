# GRIDLY V142.1 — Reflow Low-Risk Patch

## Exact changes

1. **Map resize guard introduced in `installMapLayoutResizeSafety()`**
   - Added a size snapshot (`lastMapSize`) based on `#map` client width/height.
   - Added guarded invalidate helper (`invalidateMapIfSizeChanged`) that only calls `map.invalidateSize` when dimensions changed or when force is explicitly requested.
   - Added counters for:
     - `skippedMapInvalidates`
     - `forcedMapInvalidates`
   - Initial layout boot call now uses `scheduleMapResize({ force: true })`.

2. **`scheduleMapResize` timing kept intact but guarded**
   - Existing `requestAnimationFrame` and trailing `setTimeout` scheduling retained.
   - Both paths now route through the guard helper to avoid redundant invalidation cycles.

3. **Reflow audit helper expanded**
   - `window.gridlyReflowAudit()` now includes:
     - `mapResizeGuardActive`
     - `lastMapSize`
     - `skippedMapInvalidates`
     - `forcedMapInvalidates`
     - `passiveAuditOnlyConfirmed`

4. **Portrait V2 measurement helpers deferred to rAF**
   - `window.gridlyPortraitV2LayerAudit()` now executes geometry/computed-style reads inside `requestAnimationFrame` and returns a Promise.
   - `window.gridlyPortraitV2SheetState()` now executes geometry/computed-style reads inside `requestAnimationFrame` and returns a Promise.
   - This keeps these diagnostics passive and out of immediate hot-path read/write interleaving.

## Intentionally not optimized

Per patch constraints, no broad rendering optimizations were applied to:
- `renderAlerts`
- `renderUnifiedIncidents`
- `refreshReportHazardViews`

No redesign or behavior changes were made to:
- Route Watch logic
- report lifecycle behavior

## Protected systems (untouched by this patch)

- Supabase integration
- hazards domain logic
- crossings domain logic
- routing flow/state logic
- saved places architecture
- desktop architecture
- landscape architecture

## Validation checklist

- [ ] `node --check js/app.js`
- [ ] Hard refresh app
- [ ] Open Route Setup
- [ ] Scroll panel
- [ ] Open Manage Places
- [ ] Open Route Watch
- [ ] View Route
- [ ] Confirm route renders
- [ ] Tap Map Location
- [ ] Use My Location
- [ ] Verify crossing popup behavior
- [ ] Run `window.gridlyReflowAudit()` and confirm guard fields/counters
- [ ] Confirm no regressions in route/report behavior
