# GRIDLY V142.4 — Portrait V2 Layout Batching Patch

## Scope
This patch is intentionally low-risk and limited to Portrait V2 batching and measurement paths:
- `applyPortraitV2SurfaceContainment()`
- `gridlyPortraitV2SheetState()`
- portrait sheet/backdrop transition-adjacent read/write behavior
- `window.gridlyReflowAudit()` output expansion

## What changed
- Added a small Portrait V2 batching utility that executes write phases immediately and defers read phases to the next `requestAnimationFrame`.
- Added a per-frame measurement cache for portrait read paths to avoid repeated same-frame calls to:
  - `getComputedStyle()`
  - `getBoundingClientRect()`
- Updated `applyPortraitV2SurfaceContainment()` to batch writes first, then run visibility reads in RAF.
- Updated `gridlyPortraitV2SheetState()` to run in the shared batched read phase and reuse cached computed style/rect values.
- Expanded `window.gridlyReflowAudit()` with:
  - `portraitMeasurementCacheActive`
  - `cachedReadHits`
  - `cachedReadMisses`
  - `portraitBatchingActive`

## Expected behavior
- No user-visible behavior changes.
- Fewer read-after-write layout contention patterns in Portrait V2 interactions.
- Lower forced reflow intensity/frequency in audit-heavy and sheet-state paths.

## Validation
- Syntax check: `node --check js/app.js`
- Manual flow (recommended):
  1. Hard refresh.
  2. Open Route Setup.
  3. Scroll Route Setup.
  4. Open Manage Places.
  5. Open Route Watch.
  6. View Route.
  7. Confirm route renders.
  8. Run `window.gridlyReflowAudit()` and inspect new counters/flags.
