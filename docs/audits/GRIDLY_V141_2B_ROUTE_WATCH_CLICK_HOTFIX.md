# GRIDLY V141.2b — Route Watch Click Regression Hotfix

## Root cause
The V2 Route Setup buttons (`Open Route Watch`, `View Route`) were relying on per-button click bindings attached when the sheet body was rendered. After V141.2 safe debug cleanup, the startup capture-phase diagnostics listener was removed, which also removed the only always-on capture click path that consistently let those route actions survive sheet/body re-render timing and interception edge cases in portrait sheet mode.

In short: the route actions had no resilient delegated capture handler, so under some render/interception timing states they appeared non-responsive.

## Exact code restored or adjusted
Adjusted `bindV2SheetActions()` in `js/app.js` to add a **minimal, scoped capture-phase delegated listener** on `#gridlyPortraitV2SheetBody` for:
- `[data-v2-action="route-watch-open"]`
- `[data-v2-action="route-preview-open"]`

Behavior:
- Ignore disabled buttons.
- `preventDefault()` + `stopPropagation()`.
- Call existing `triggerV2DockAdapter(...)` with the button's `data-v2-action`.
- Bound once via `body.dataset.routeDelegateBound = "1"`.

## Why it broke
The debug cleanup removed a document-level capture click listener that, while intended only for diagnostics, had been masking fragility in route action click handling under certain sheet interaction states. Without that top-level capture path, route action clicks could fail to reach the intended action pipeline consistently.

## What was intentionally not restored
- `installMapClickDiagnostics()` startup call was **not** restored.
- Document-wide map click diagnostic listener was **not** restored.
- `traceMobileModeMutation(...)` and no-op mutation tracing callsites were **not** restored.
- No route algorithm/selection logic was modified.
- No UI redesign/layout changes were made.

## Validation checklist
- [ ] Hard refresh
- [ ] Tap Map Location works
- [ ] Use My Location works
- [ ] Report submit works
- [ ] Crossing popup opens
- [ ] Route Setup opens
- [ ] Open Route Watch button responds
- [ ] View Route button responds
- [ ] Route Watch still shows saved-place status correctly
- [ ] No startup geolocation warning
- [ ] `window.gridlyRefreshAudit()` works
- [ ] `window.gridlyGeoAudit()` works
- [ ] `window.gridlyActiveIncidentAudit()` works
