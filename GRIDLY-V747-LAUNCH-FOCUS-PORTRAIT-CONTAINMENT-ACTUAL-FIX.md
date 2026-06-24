# GRIDLY V747 — Launch-Focus Portrait Containment Actual Fix

## Final determination
PASS — V747 applies real launch-focus desktop-browser portrait containment to the actual visible mobile root instead of relying on state markers only.

## Actual containment root cause
V746 marked launch-focus portrait validation on `body`, but the visible Portrait V2 root, `#gridlyPortraitV2`, was still styled as a fixed full-viewport shell. Its fixed-position chrome continued to resolve against the desktop viewport, so the audit correctly reported `portrait_container_missing_or_wide`.

## Measured portrait root
The audit measures `#gridlyPortraitV2`, the primary Portrait V2 shell and visible mobile-owned surface in launch-focus validation.

## Patch applied
The smallest confirmed fix is CSS-only containment for launch-focus desktop validation plus audit diagnostics. Under `body[data-layout-mode="portrait"].gridly-launch-focus-portrait-validation`, `#gridlyPortraitV2` is centered, capped at 430px, transformed to create the containing block for fixed descendants, and layout/paint contained. The isolation audit now reports viewport/root widths, width containment, class presence, and applied style state.

## What changed
- Added launch-focus-only phone-width containment to the actual Portrait V2 root.
- Added max-width protection for major Portrait V2 fixed chrome inside that root.
- Updated `window.gridlyOperationsIsolationAudit?.()` diagnostics for V747.
- Added V747 evidence and validation script.

## What did not change
- No mobile portrait visual hierarchy wording changed.
- No bottom dock behavior changed except launch-focus desktop containment bounds.
- No Awareness Brief, Community Pulse, Location Awareness, alert generation, report lifecycle, Route Watch, marker rendering, or refresh pipeline behavior changed.
- No Operations Center live UI was built or enabled.

## Mobile experience confirmation
Actual mobile-device behavior is preserved because the new containment selector only applies when the body has `gridly-launch-focus-portrait-validation`, which is produced by desktop-gate-suppressed launch-focus validation. Normal mobile portrait layout continues to use the existing portrait CSS.

## Operations isolation confirmation
Operations Center remains disabled by default. The shell remains registered but non-rendered, and the data bridge remains registered/read-only but non-rendered when disabled.

## Desktop gate behavior
Default local desktop browser launch-focus validation keeps the desktop gate hidden and the mobile portrait experience visible. Intentional desktop gate override remains available through the pre-existing explicit gate controls.

## Protected-system confirmation
Protected systems remain unchanged: `historicalReadsEnabled: false`, `historyUiEnabled: false`, `DriveTexasPaused: true`, `TransportationIntelligenceEnabled: false`, `TransportationIntelligenceDisplay: false`, and `TransportationIntelligenceActivation: false`.

## Denise browser validation steps
1. Open the app in the default local desktop browser validation viewport with no `gridlyDesktopGate` query parameter.
2. Run `window.gridlyOperationsIsolationAudit?.()`.
3. Confirm `status: "PASS"`, `desktopGateVisible: false`, `mobileExperienceVisible: true`, `mobilePortraitContained: true`, `portraitContainmentReason: "launch_focus_portrait_container_active"`, `containedByWidth: true`, `containmentClassPresent: true`, `containmentStyleApplied: true`, `operationsCenterEnabled: false`, `shellRendered: false`, `dataBridgeRendered: false`, `operationsGateSideEffectDetected: false`, and `safeForMobile: true`.
4. Run `window.gridlyOperationsDataBridgeAudit?.()` and confirm the bridge remains read-only/non-rendered while disabled.
5. Run `window.gridlyRefreshBreakdownAudit?.()` and confirm refresh performance remains fast.
6. Run `window.gridlyUiSmokeTest?.()` and confirm UI smoke remains healthy.

## Merge recommendation
MERGE after the required validation commands pass.
