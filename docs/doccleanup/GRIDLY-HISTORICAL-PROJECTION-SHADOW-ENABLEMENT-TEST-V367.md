# V367 — Historical Projection Shadow Enablement Test

## Milestone Scope

V367 validates the existing `GRIDLY_ENABLE_HISTORICAL_PIPELINE` feature flag when the shadow historical projection pipeline is enabled for testing. The default remains `false` and no production read, write, lifecycle, UI, marker, awareness, Route Watch, DriveTexas, migration, backfill, or schema behavior is approved by this milestone.

## Enablement Strategy

- Keep `GRIDLY_ENABLE_HISTORICAL_PIPELINE` defaulted to `false`.
- Allow manual validation by setting `window.GRIDLY_ENABLE_HISTORICAL_PIPELINE = true` in a browser console before running audits.
- Support audit-only forced enablement through `window.gridlyHistoricalProjectionEnablementAudit({ forceEnable: true })` and `window.gridlyHistoricalProjectionIsolationAudit({ forceEnable: true })`; these helpers restore the original window flag after the audit.
- Generate projections only into the existing in-memory shadow projection state.

## Validation Methodology

The enablement audit validates:

- feature flag state
- projection generation success
- projection generation count stability
- projection availability
- parity state
- drift state
- runtime state
- production safety state

Recommended manual sequence:

```js
window.gridlyHistoricalProjectionEnablementAudit({ forceEnable: true })
window.gridlyHistoricalProjectionIsolationAudit({ forceEnable: true })
window.gridlyHistoricalParityAudit()
window.gridlyHistoricalProjectionHealthAudit()
```

## Production Isolation Validation

V367 adds snapshot-based diagnostics around shadow projection generation. The isolation snapshot records production-facing counts and observable state for:

- active hazard count
- active report count
- live hazard incident count
- unified road incident count
- active unified incident count
- alert list DOM count
- awareness microline state key
- rendered marker count, when marker diagnostics exist
- Route Watch layer presence
- active hazard count reconciliation audit result, when available

The audit expects shadow projection generation to leave these unchanged.

## Enablement Audit

`window.gridlyHistoricalProjectionEnablementAudit?.()` returns pass/fail findings for shadow enablement readiness. When the flag is not enabled, the feature-flag finding fails intentionally and instructs the tester to enable the flag or use `{ forceEnable: true }`. This prevents accidental interpretation of disabled-default preview validation as true enabled-pipeline validation.

## Isolation Audit

`window.gridlyHistoricalProjectionIsolationAudit?.()` reports explicit booleans for:

- `productionReadsChanged`
- `productionWritesChanged`
- `lifecycleChangesDetected`
- `uiOwnershipChangesDetected`
- `markerOwnershipChangesDetected`
- `awarenessOwnershipChangesDetected`

Expected values are all `false`. The audit also reports whether active incident counts or count reconciliation outputs changed during shadow generation.

## Expanded Existing Audits

- `window.gridlyHistoricalParityAudit?.()` now includes shadow enablement confidence, production isolation confidence, and projection generation confidence.
- `window.gridlyHistoricalProjectionHealthAudit?.()` now includes enablement status, generation success, and isolation status.

## Known Limitations

- The audits prove shadow-pipeline behavior only for the currently loaded runtime state.
- DOM-derived alerts, marker, and Route Watch diagnostics depend on the app having rendered those surfaces before audit execution.
- Forced enablement is audit-only and restores the previous flag; it does not persist configuration.
- The projection remains an in-memory shadow artifact and is not a production data source.

## Future Migration Prerequisites

Before any future migration milestone, Gridly still needs explicit approval and validation for:

- production historical reads
- production historical writes
- schema/storage migrations
- backfill plans
- lifecycle transitions into history
- history UI ownership
- DriveTexas activation or integration
- user-facing alert, awareness, marker, and Route Watch ownership changes

## Explicit Safety Statement

V367 does **not** approve:

- migrations
- production read changes
- production write changes
- history UI
- schema migration
- DriveTexas activation
