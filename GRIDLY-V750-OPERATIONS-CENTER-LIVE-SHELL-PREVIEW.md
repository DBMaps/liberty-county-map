# GRIDLY V750 — Operations Center Live Shell Preview

## Final determination
PASS — the first live Operations Center shell preview is available only behind `GRIDLY_OPERATIONS_CENTER_ENABLED` or the explicit non-persistent test helper. The default flag remains false, so production/mobile behavior remains unchanged.

## Preview scope
V750 renders a dark, card-based, read-only Operations Center preview with the required header, mission subline, county label, and live preview cards for Community Status, Active Incidents, Community Pulse, Corridor Status, Community Summary, New Reports, Recently Cleared, Route Intelligence Summary, and Source Health.

## Data bridge usage
The preview renders only from the V743 `window.gridlyOperationsDataBridgeAudit()` snapshot. It does not fetch, write, create timers, or duplicate ownership of Community Pulse, Route Watch, count reconciliation, lifecycle, marker, or route intelligence logic.

## Default disabled behavior
With `GRIDLY_OPERATIONS_CENTER_ENABLED` at its protected default false value, the shell does not render, the data bridge is not considered rendered, the preview does not render, and `safeForMobile` remains true.

## Enabled preview behavior
For browser validation only, `window.gridlyEnableOperationsCenterPreviewForTest?.()` toggles runtime state in memory and renders the preview. `window.gridlyDisableOperationsCenterPreviewForTest?.()` removes the preview and restores the protected default flag value. These helpers do not persist production enablement.

## Isolation confirmation
The preview is isolated from the mobile portrait DOM, the bottom dock, the mobile refresh loop, map takeover behavior, navigation actions, officer SOS, CAD workflows, alert generation, report lifecycle, markers, and Route Watch behavior.

## What changed
- Added live read-only Operations Center preview rendering behind the protected flag.
- Added isolated dark dashboard card styles.
- Added explicit non-persistent browser test helpers.
- Extended Operations isolation audit fields for preview rendering, bridge usage, read-only safety, fetch/timer/write safety, mobile DOM safety, refresh pipeline safety, and ownership safety.

## What did not change
- Dispatch Board remains in place.
- Mobile portrait layout and bottom dock are unchanged when the flag is false.
- Awareness Brief, Community Pulse, Location Awareness, Route Watch, lifecycle, marker rendering, and alert generation wording/logic are unchanged.
- No backend tables, new fetches, timers, writes, historical reads, DriveTexas, or Transportation Intelligence activation were added.

## Protected-system confirmation
Protected systems remain locked: `historicalReadsEnabled: false`, `historyUiEnabled: false`, `DriveTexasPaused: true`, `TransportationIntelligenceEnabled: false`, `TransportationIntelligenceDisplay: false`, and `TransportationIntelligenceActivation: false`.

## Denise browser validation steps
Default disabled:
```js
window.gridlyOperationsIsolationAudit?.()
window.gridlyOperationsDataBridgeAudit?.()
window.gridlyRefreshBreakdownAudit?.()
window.gridlyUiSmokeTest?.()
```

Enabled preview:
```js
window.gridlyEnableOperationsCenterPreviewForTest?.()
window.gridlyOperationsIsolationAudit?.()
window.gridlyOperationsDataBridgeAudit?.()
window.gridlyRefreshBreakdownAudit?.()
window.gridlyUiSmokeTest?.()
window.gridlyDisableOperationsCenterPreviewForTest?.()
```

Expected default disabled audit highlights: `operationsCenterEnabled: false`, `shellRendered: false`, `dataBridgeRendered: false`, `previewRendered: false`, `safeForMobile: true`.

Expected enabled preview audit highlights: `operationsCenterEnabled: true`, `previewRendered: true`, `previewUsesDataBridge: true`, `previewReadOnly: true`, `previewCreatesNoWrites: true`, `previewCreatesNoFetches: true`, `previewCreatesNoTimers: true`.

## Merge recommendation
Merge V750 after the required validation scripts pass. This milestone is safe for launch-focus mobile because the preview is off by default and isolated behind the Operations Center flag.
