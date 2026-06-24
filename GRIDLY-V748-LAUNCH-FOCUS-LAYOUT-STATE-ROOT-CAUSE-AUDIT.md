# GRIDLY V748 — Launch Focus Layout State Root Cause Audit

## Final determination
ROOT CAUSE FOUND. Launch-focus portrait containment is owned by `applyLayoutMode()`, targets `body`, and is currently gated by `lastLayoutSignal.desktopGateSuppressedForLaunchFocus`. Browser validation reached a portrait/mobile-visible state without that flag, so `body.gridly-launch-focus-portrait-validation` was not present and the CSS selector for `#gridlyPortraitV2` never activated.

## Root cause found or not found
Found. This is a layout-state activation bug, not a CSS sizing bug. The containment CSS exists, but its required state class is absent.

## Layout state ownership map
- `computeLayoutModeSignals()` reads viewport, shell width, command width, horizontal overflow, and pointer signals.
- `resolveLayoutMode()` decides `nextMode` and whether the desktop gate was suppressed for launch focus.
- `evaluateLayoutMode()` records `lastLayoutSignal`.
- `applyLayoutMode()` is the writer for `body[data-layout-mode]`, `body[data-layout-mode-legacy]`, `body[data-mobile-mode]`, and the launch-focus containment body class.

## Desktop gate ownership map
- `#gridlyDesktopGate` is static markup.
- CSS keyed by `body[data-layout-mode="desktop"]` owns whether the desktop gate appears.
- V745 suppression occurs by returning `portrait` instead of `desktop` only when `forcedDesktop` and `shouldSuppressGridlyDesktopGateForLaunchFocus()` are both true.
- Operations Center does not show the desktop gate when disabled.

## Portrait containment ownership map
- `#gridlyPortraitV2` is static markup.
- `body[data-layout-mode="portrait"] #gridlyPortraitV2` displays the portrait root.
- `body[data-layout-mode="portrait"].gridly-launch-focus-portrait-validation #gridlyPortraitV2` applies the 430px launch-focus containment.
- `applyLayoutMode()` is the current owner that should apply `gridly-launch-focus-portrait-validation` to `body`.

## Exact reason containment did not activate
The active code applies the class only when all of these are true:

1. `activeLayoutMode === "portrait"`
2. `shouldSuppressGridlyDesktopGateForLaunchFocus()` is true
3. `lastLayoutSignal?.desktopGateSuppressedForLaunchFocus === true`

The third condition is too narrow. It is only true when the resolver was on the forced-desktop branch and deliberately converted desktop to portrait. If the resolver chooses or retains portrait for width, container collapse, or overflow reasons, portrait UI can be visible while the launch-focus containment class is false.

## Why portraitMaxAllowedWidth was 980 instead of 430
The V747 isolation audit reports `portraitMaxAllowedWidth` as `430` only when `isGridlyLaunchFocusPortraitValidationActive()` is true. That helper also depends on `lastLayoutSignal.desktopGateSuppressedForLaunchFocus` or the existing body class. Because neither was true, the audit used the fallback `Math.min(viewportWidth || portraitRootWidth || 980, 980)`, producing `980`.

## Whether Operations Center caused the issue
No. Operations Center is not the cause. It remains disabled by default, its shell is not rendered, and its read-only data bridge does not own layout mode, desktop-gate CSS, portrait visibility, or containment state. This is an older desktop-gate/layout-mode coupling exposed by the V745 desktop-gate suppression work.

## Recommended next fix
In a future behavior-change milestone, decouple launch-focus portrait containment from `lastLayoutSignal.desktopGateSuppressedForLaunchFocus`. The containment class should be applied to `body` whenever launch-focus mobile validation is active and the final resolved layout is `portrait`. V748 intentionally does not implement that behavior change.

## What changed
- Added read-only trace timestamps for layout resolver decisions and containment state apply/remove events.
- Added `window.gridlyLaunchFocusLayoutStateAudit?.()`.
- Added V748 evidence, report, and validation script.

## What did not change
- No layout behavior changed.
- No desktop gate behavior changed.
- No Portrait V2 sizing or containment CSS changed.
- No Operations Center shell or data bridge behavior changed.
- No refresh, Community Pulse, Route Watch, report lifecycle, marker rendering, history, DriveTexas, or Transportation Intelligence behavior changed.

## Protected-system confirmation
- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `DriveTexasPaused: true`
- `TransportationIntelligenceEnabled: false`
- `TransportationIntelligenceDisplay: false`
- `TransportationIntelligenceActivation: false`

## Denise validation steps
```js
window.gridlyLaunchFocusLayoutStateAudit?.()
window.gridlyOperationsIsolationAudit?.()
window.gridlyOperationsDataBridgeAudit?.()
window.gridlyRefreshBreakdownAudit?.()
window.gridlyUiSmokeTest?.()
```

Expected V748 audit outcome: `rootCauseFound: true`, `containmentClassElementExpected: "body"`, and `answerWhyContainmentClassPresentFalse` identifies the `lastLayoutSignal.desktopGateSuppressedForLaunchFocus` gate.

## Merge recommendation
Merge V748 as an audit-only milestone. Do not treat it as the containment behavior fix. The next milestone should implement the recommended decoupling and rerun browser validation.
