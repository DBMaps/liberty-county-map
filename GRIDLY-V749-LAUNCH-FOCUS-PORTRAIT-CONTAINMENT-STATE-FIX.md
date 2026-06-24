# GRIDLY V749 — Launch Focus Portrait Containment State Fix

## Final determination
PASS. V749 fixes the layout-state activation bug found by V748. Launch-focus portrait containment is now applied to `body` when mobile validation is active and the final active layout mode is `portrait`, without requiring the narrow forced-desktop suppression branch.

## V748 root cause addressed
V748 found that `applyLayoutMode()` owned the containment class but only activated it when `lastLayoutSignal.desktopGateSuppressedForLaunchFocus === true`. V749 removes that narrow dependency from the activation rule so portrait validation paths selected by width, container collapse, overflow, retained portrait mode, or launch-focus desktop-gate bypass can still receive containment.

## Patch applied
`applyLayoutMode()` now toggles `body.gridly-launch-focus-portrait-validation` when the final active layout mode is `portrait`, launch-focus/mobile validation is enabled, Operations Center remains disabled, and no intentional desktop gate override is requested. The audit helper now reports the fixed activation reason instead of an unresolved root-cause recommendation.

## Containment activation rule
Containment activates when all of the following are true:

1. Operations Center is disabled.
2. The final active layout mode is `portrait`.
3. The desktop gate is not intentionally requested.
4. Launch-focus/mobile-validation context is active, or the desktop gate has been suppressed/bypassed for launch-focus validation.

When active, the expected reason is `launch_focus_portrait_container_active` and the expected class target is `body`.

## Intentional desktop gate override preserved
The fix preserves explicit desktop gate requests:

- `?gridlyDesktopGate=1`
- `?gridlyDesktopGate=true`
- `data-gridly-desktop-gate="enabled"` on `html` or `body`

Those override paths continue to prevent launch-focus desktop-gate suppression and therefore prevent the validation containment class from being applied.

## What changed
- Decoupled launch-focus portrait containment activation from `lastLayoutSignal.desktopGateSuppressedForLaunchFocus` as a required condition.
- Updated `isGridlyLaunchFocusPortraitValidationActive()` to reflect final portrait/mobile-validation state.
- Updated the V748 RCA helper output so it reports the V749 fixed state, containment class on `body`, containment style application, portrait root width bounds, final layout mode, and containment activation reason.
- Added V749 evidence and validation coverage.

## What did not change
- No mobile portrait visual hierarchy changed.
- No bottom dock behavior changed except containment state eligibility.
- No Awareness Brief wording changed.
- No Community Pulse wording changed.
- No Location Awareness wording changed.
- No alert generation changed.
- No report lifecycle changed.
- No Route Watch behavior changed.
- No marker rendering changed.
- No refresh pipeline changed.
- No Dispatch Board replacement was added.
- No Operations Center live UI was built or enabled by default.
- No DriveTexas, Transportation Intelligence, historical read, or historical UI behavior was enabled.

## Protected-system confirmation
- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `DriveTexasPaused: true`
- `TransportationIntelligenceEnabled: false`
- `TransportationIntelligenceDisplay: false`
- `TransportationIntelligenceActivation: false`

## Denise browser validation steps
```js
window.gridlyLaunchFocusLayoutStateAudit?.()
window.gridlyOperationsIsolationAudit?.()
window.gridlyOperationsDataBridgeAudit?.()
window.gridlyRefreshBreakdownAudit?.()
window.gridlyUiSmokeTest?.()
```

Expected browser result highlights:

- `status: "PASS"`
- `desktopGateVisible: false`
- `mobileExperienceVisible: true`
- `mobilePortraitContained: true`
- `portraitContainmentReason: "launch_focus_portrait_container_active"`
- `containedByWidth: true`
- `containmentClassPresent: true`
- `containmentStyleApplied: true`
- `operationsCenterEnabled: false`
- `shellRendered: false`
- `dataBridgeRendered: false`
- `operationsGateSideEffectDetected: false`
- `safeForMobile: true`

## Merge recommendation
Merge V749. It is the behavior fix for the V748 root cause and preserves all protected systems and intentional desktop-gate override paths.
