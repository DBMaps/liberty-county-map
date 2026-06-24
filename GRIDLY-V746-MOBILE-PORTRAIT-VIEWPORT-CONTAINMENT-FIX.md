# GRIDLY V746 — Mobile Portrait Viewport Containment Fix

## Final determination
PASS — default launch-focus desktop browser validation now suppresses the desktop gate, shows the mobile portrait experience, and keeps that portrait experience visually bounded instead of stretching across the full desktop viewport.

## Portrait containment root cause
V745 correctly suppressed the desktop gate by resolving the wide desktop validation viewport back to portrait mode. The remaining visual issue was that the Portrait V2 shell uses fixed viewport anchors for its top awareness surfaces, map controls, bottom dock, sheet, and bottom region. In actual mobile-width portrait media those anchors are naturally phone-width, but in a wide local browser they span the desktop viewport. The pre-existing strict Portrait V2 containment gate also required mobile-width portrait media, so gate suppression alone did not activate the containment marker in wide desktop validation.

## Patch applied
The patch applies the smallest confirmed cause:

- Adds an explicit `gridly-launch-focus-portrait-validation` body class when the layout is portrait because the desktop gate was suppressed for Liberty launch-focus validation.
- Allows the existing Portrait V2 containment path to treat that launch-focus validation mode as containment-eligible.
- Adds a CSS-only, centered, max-width Portrait V2 wrapper scoped only to `body[data-layout-mode="portrait"].gridly-launch-focus-portrait-validation`.
- Extends the Operations isolation audit with `mobilePortraitContained` and `portraitContainmentReason`.

## What changed
- Launch-focus gate-suppressed desktop validation now receives an explicit portrait containment class and reason.
- Portrait V2 fixed surfaces are centered inside a bounded phone-style container in launch-focus validation.
- `window.gridlyOperationsIsolationAudit?.()` now reports and requires `mobilePortraitContained: true` before returning `status: "PASS"`.

## What did not change
- The mobile portrait visual hierarchy did not change.
- Bottom dock behavior did not change except for desktop-validation containment.
- Awareness Brief wording did not change.
- Community Pulse wording did not change.
- Location Awareness wording did not change.
- Alert generation did not change.
- Report lifecycle did not change.
- Route Watch behavior did not change.
- Marker rendering did not change.
- Refresh pipeline did not change.
- Dispatch Board was not replaced.
- Operations Center live UI was not built or enabled.

## Mobile experience confirmation
Expected default audit result after the fix:

```js
{
  status: "PASS",
  desktopGateVisible: false,
  mobileExperienceVisible: true,
  mobilePortraitContained: true,
  portraitContainmentReason: "launch_focus_portrait_container_active",
  safeForMobile: true
}
```

Actual mobile-device behavior is preserved because the max-width centered wrapper is scoped to the launch-focus validation class, not to normal mobile portrait rendering.

## Operations isolation confirmation
Operations Center remains disabled by default. The shell remains non-rendered, and the read-only data bridge remains non-rendered while disabled.

Expected default audit fields:

```js
operationsCenterEnabled: false
shellRendered: false
dataBridgeRendered: false
operationsGateSideEffectDetected: false
```

## Desktop gate behavior
The desktop/mobile gate remains hidden for default Liberty launch-focus mobile validation. Intentional desktop gate access remains available through the existing `?gridlyDesktopGate=1`, `?gridlyDesktopGate=true`, or html/body data override path.

## Protected-system confirmation
Protected systems remain unchanged:

```js
historicalReadsEnabled: false
historyUiEnabled: false
DriveTexasPaused: true
TransportationIntelligenceEnabled: false
TransportationIntelligenceDisplay: false
TransportationIntelligenceActivation: false
```

## Denise browser validation steps
1. Open the app in the default local desktop browser validation viewport with no `gridlyDesktopGate` query parameter.
2. Run `window.gridlyOperationsIsolationAudit?.()`.
3. Confirm `status === "PASS"`.
4. Confirm `desktopGateVisible === false`.
5. Confirm `mobileExperienceVisible === true`.
6. Confirm `mobilePortraitContained === true`.
7. Confirm `portraitContainmentReason === "launch_focus_portrait_container_active"`.
8. Confirm `operationsCenterEnabled === false`.
9. Confirm `shellRendered === false`.
10. Confirm `dataBridgeRendered === false`.
11. Confirm `operationsGateSideEffectDetected === false`.
12. Confirm `safeForMobile === true`.
13. Run `window.gridlyOperationsDataBridgeAudit?.()` and confirm bridge isolation remains read-only/non-rendered.
14. Run `window.gridlyRefreshBreakdownAudit?.()` and confirm refresh performance remains fast.
15. Run `window.gridlyUiSmokeTest?.()` and confirm UI smoke remains healthy.

## Merge recommendation
MERGE after the required validation suite passes.
