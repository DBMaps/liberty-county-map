# GRIDLY V753 — Revert Operations Center Mobile Regressions

## Final determination

BLOCKED pending Denise visual confirmation. V753 removes the Operations Center preview visual paths that regressed mobile portrait and restores launch-focus mobile containment priority.

## Exact root cause removed

The regression source was the Operations Center preview presentation path introduced after the validated mobile containment state. V753 disables/removes:

- V751 dashboard layout hierarchy rendering.
- V751 premium Operations Center visual CSS.
- V751R fixed isolated preview host DOM path.
- V752 off-canvas/mobile preview CSS and visual containment preview path.
- Any Operations Center preview DOM capable of rendering beside, over, or within the mobile app.

## Operations preview status

Operations Center preview is temporarily disabled. The foundation flag, shell registration stub, isolation audit helper, and V743 read-only data bridge remain available only where they do not render UI or affect mobile geometry.

Expected Operations audit while disabled:

- `operationsCenterEnabled: false`
- `shellRendered: false`
- `previewRendered: false`
- `safeForMobile: true`

The test helper `window.gridlyEnableOperationsCenterPreviewForTest?.()` remains registered but is intentionally disabled for V753. It removes any existing preview DOM, leaves `GRIDLY_OPERATIONS_CENTER_ENABLED` false, and returns a safe disabled result.

## Mobile portrait audit expected result

`window.gridlyMobilePortraitVisualIntegrityAudit?.()` remains available and uses live DOM geometry from `getBoundingClientRect()`.

Expected result:

- `mobilePortraitIntegrityPass: true`
- `horizontalSplitDetected: false`
- `mobileContentClipped: false`
- `leftBleedDetected: false`
- `operationsCssLeakDetected: false`
- `operationsPreviewAffectsMobileLayout: false`

## What changed

- Replaced Operations Center render path with a disabled mobile-safe stub.
- Disabled the preview enable helper so it cannot visually affect mobile.
- Removed Operations Center preview and dashboard CSS.
- Updated Operations layout/visual audits to report V753 disabled-for-mobile-revert state.
- Added V753 evidence and validation coverage.

## What did not change

- No mobile refresh, report, Route Watch, Community Pulse, marker, alert, or lifecycle ownership changes were made.
- The V741 foundation flag remains default false.
- The V743 read-only data bridge remains available and non-rendered while disabled.
- V749 portrait containment remains the mobile launch containment baseline.

## Denise browser validation block

Run in the browser console:

```js
window.gridlyMobilePortraitVisualIntegrityAudit?.()
window.gridlyOperationsIsolationAudit?.()
window.gridlyOperationsDataBridgeAudit?.()
window.gridlyRefreshBreakdownAudit?.()
window.gridlyUiSmokeTest?.()
```

## Merge recommendation

Do not merge as fully unblocked until Denise visually confirms mobile portrait launch is restored. Once visual confirmation is complete and the required command validations pass, merge V753 as the emergency mobile regression revert.
