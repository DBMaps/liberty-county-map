# V344A — Lightweight Road Hazard Location Audit

## Goal

Audit the FM 1960 flooding alert location mismatch without changing production behavior.

## Scope

This is audit-only instrumentation. It does not rewrite alerts, mutate alert snapshots, change rendering, add a location bridge, perform recursive ownership lookup, or scan active hazards inside alert shaping.

## Browser helper

Run the helper manually from DevTools:

```js
window.gridlyLightweightRoadHazardLocationAudit?.()
```

The helper returns a read-only object with:

- `available: true`
- `policyVersion: "V344A"`
- `productionBehaviorChanged: false`
- `lightweightAuditOnly: true`
- `alertMutationUsed: false`
- `bridgeUsed: false`
- `roadHazardsChecked`
- `locationMismatchCount`
- `fm1960ExpectedButUs90WacoDetected`
- `rows`
- `findings`
- `recommendations`
- `notes`

## Read-only inputs

The audit reads only these existing sources when available:

1. Active road incidents from `getActiveUnifiedIncidents()`.
2. Alert diagnostic rows from `getAlertsSurfaceSnapshot().alerts` or the latest rendered alert cache.
3. Rendered alert DOM text, if the alert surface has rendered.
4. Top awareness text, if the awareness surface has rendered.

## Mismatch policy

The audit identifies mismatches only. The specific V344A check flags rows where FM 1960 context is expected but U.S. 90 / Waco alert text is detected. It reports those rows in `rows` and summarizes them in `findings`.

## Non-goals

- No alert rewriting.
- No alert snapshot mutation.
- No render changes.
- No location bridge.
- No recursive ownership lookup.
- No active-hazard scans inside alert shaping.
- No source-object mutation.

## Recommended follow-up

If the helper reports `locationMismatchCount > 0`, inspect the upstream road-hazard shaping and source ownership in a separate scoped change. Do not fix or rewrite locations from this audit helper.
