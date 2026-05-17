# GRIDLY V140.4 — Active Incident Visibility Audit

## Scope

Audit-only instrumentation for generated road incidents. No behavior, rendering, or data mutation changes were made.

## Added Developer Helper

`window.gridlyActiveIncidentAudit()`

### What it returns

- `generatedRoadIncidents[]` entry per generated road incident from `getLiveHazardIncidents()` including:
  - `roadIncidentId`
  - `clusterKey`
  - `sourceReportIds`
  - `sourceReportTypes`
  - `source`
  - `created_at`
  - `expires_at`
  - `lifecycleState` (via `getIncidentLifecycleState()`)
  - `expired`
  - `coordinates` (`lat`, `lng`)
  - `routeImpactStatus` (if present on source report)
  - `inclusionReason` with exact inclusion rules used by `getLiveHazardIncidents()`
- `summary` object including:
  - `generatedRoadIncidentCount`
  - `activeHazardsCount`
  - `activeReportsCount`
  - `lifecycleStateTotals`
  - `reportTypeTotals`

## Inclusion logic captured in audit output

A generated road incident exists when source hazard rows:

1. Are present in `activeHazards[]`
2. Have `expired === false`
3. Have `type !== "hazard_cleared"`
4. Are grouped by `getHazardClusterKey(type + lat/lng rounded to 3 decimals)`

## Usage

Open browser console and run:

```js
window.gridlyActiveIncidentAudit();
```

The helper also logs the full payload with:

```text
gridlyActiveIncidentAudit
```
