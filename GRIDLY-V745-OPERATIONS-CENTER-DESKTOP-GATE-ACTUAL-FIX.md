# GRIDLY V745 — Operations Center Desktop Gate Actual Fix

## Final determination
PASS — the active desktop/mobile gate issue is fixed at the confirmed root cause. In default Liberty launch focus mode with `GRIDLY_OPERATIONS_CENTER_ENABLED === false`, the app no longer remains stuck on the desktop gate during local desktop browser validation; the mobile portrait experience is the default visible experience and the Operations Center remains non-rendered.

## Actual gate root cause
The gate is not rendered by the Operations Center shell or data bridge. The exact gate system is the static `#gridlyDesktopGate` element in `index.html`, exposed by CSS when the body has `data-layout-mode="desktop"`. The runtime layout resolver selected `desktop` for wide local desktop browser viewports (`desktopByWidth`, no horizontal overflow, non-coarse pointer), and that CSS rule hid the application shell and displayed the desktop beta gate.

## Gate source/reason
- `desktopGateSource`: `css_body_data_layout_mode_desktop_gridlyDesktopGate`
- Previous active reason: `desktop_layout_width_gate`
- Fixed default reason: `suppressed_for_launch_focus_or_mobile_validation`

## Patch applied
The smallest confirmed fix tightens desktop gate activation conditions. When Liberty launch focus mobile validation is active, Operations Center is disabled, and the desktop gate was not intentionally requested, the layout resolver suppresses desktop mode and selects portrait mode for the default local validation workflow.

Intentional desktop gate behavior remains available via `?gridlyDesktopGate=1`, `?gridlyDesktopGate=true`, or `data-gridly-desktop-gate="enabled"` on `html`/`body`.

## What changed
- Added explicit launch-focus/mobile-validation desktop gate suppression in the authoritative layout resolver.
- Added auditable desktop gate source/reason fields.
- Added auditable mobile experience visibility reason.
- Updated Operations isolation audit to V745 and to report the required fields.
- Added V745 machine-readable evidence and validation script.

## What did not change
- Mobile portrait layout was not changed.
- Bottom dock was not changed.
- Awareness Brief wording was not changed.
- Community Pulse wording was not changed.
- Location Awareness wording was not changed.
- Report lifecycle was not changed.
- Route Watch behavior was not changed.
- Marker rendering was not changed.
- Refresh pipeline was not changed.
- Dispatch Board was not replaced.
- Operations Center was not enabled by default and no live Operations Center UI was built.
- DriveTexas, Transportation Intelligence, historical reads, and history UI remain protected/off.

## Mobile experience confirmation
Default disabled Operations state should now report `mobileExperienceVisible: true` because portrait-owned mobile surfaces can be visibly readable in the default local browser validation workflow.

## Operations isolation confirmation
Default disabled Operations state should report:

```js
{
  status: "PASS",
  operationsCenterEnabled: false,
  shellRendered: false,
  dataBridgeRendered: false,
  desktopGateVisible: false,
  desktopGateReason: "suppressed_for_launch_focus_or_mobile_validation",
  mobileExperienceVisible: true,
  operationsGateSideEffectDetected: false,
  safeForMobile: true
}
```

## Protected-system confirmation
Protected systems remain unchanged:

- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `DriveTexasPaused: true`
- `TransportationIntelligenceEnabled: false`
- `TransportationIntelligenceDisplay: false`
- `TransportationIntelligenceActivation: false`

## Denise browser validation steps
1. Open the app in the default local desktop browser validation viewport with no `gridlyDesktopGate` query parameter.
2. Run `window.gridlyOperationsIsolationAudit?.()`.
3. Confirm `status === "PASS"`.
4. Confirm `findings.operationsCenterEnabled === false`.
5. Confirm `findings.shellRendered === false`.
6. Confirm `findings.dataBridgeRendered === false`.
7. Confirm `findings.desktopGateVisible === false`.
8. Confirm `findings.desktopGateReason === "suppressed_for_launch_focus_or_mobile_validation"`.
9. Confirm `findings.mobileExperienceVisible === true`.
10. Confirm `findings.operationsGateSideEffectDetected === false`.
11. Run `window.gridlyOperationsDataBridgeAudit?.()` and confirm the bridge remains read-only/non-rendered while disabled.
12. Run `window.gridlyRefreshBreakdownAudit?.()` and confirm refresh performance remains fast.
13. Run `window.gridlyUiSmokeTest?.()` and confirm UI smoke remains healthy.

## Merge recommendation
MERGE after the required validation commands pass. V745 addresses the actual desktop gate root cause while preserving intentional desktop gate access and Operations Center isolation.
