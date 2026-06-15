# V342 — Flooding Active Incident Pipeline Audit

## Scope

V342 is audit-only. It adds the browser helper:

```js
window.gridlyFloodingActiveIncidentPipelineAudit?.()
```

The helper does not change production behavior, Supabase writes, lifecycle rules, alert rendering, marker rendering, report submission, clear behavior, Route Watch, DriveTexas, or official-source architecture.

## Pipeline Audited

The helper inspects the current in-memory pipeline after shared reports have loaded:

```text
Supabase/shared report rows
↓
normalizeReports()
↓
activeHazards / recentlyClearedRoadHazards
↓
lifecycle filtering and cleared-row suppression
↓
getLiveHazardIncidents()
↓
getUnifiedIncidents()
↓
alert cache eligibility
↓
marker eligibility/render evidence
```

## Returned Contract

The audit returns the V342 contract:

```js
{
  available: true,
  policyVersion: "V342",
  productionBehaviorChanged: false,
  floodingRowsFound,
  normalizedFloodingCount,
  activeEligibleFloodingCount,
  generatedFloodingIncidentCount,
  alertEligibleFloodingCount,
  markerEligibleFloodingCount,
  clearedFloodingRowsFound,
  clearedSuppressionDetected,
  newerFloodingSuppressedByOlderClear,
  floodingTypeRecognized,
  floodingLifecycleSupported,
  floodingAlertSupported,
  floodingMarkerSupported,
  coordinateIssuesDetected,
  lifecycleIssuesDetected,
  typeSupportIssuesDetected,
  groupingIssuesDetected,
  likelyFailureStage,
  likelyRootCause,
  rows,
  findings,
  recommendations,
  notes
}
```

## Row-Level Evidence

Each flooding-specific row reports:

- `id`
- `createdAt`
- `type`, `report_type`, and `category`
- `roadName`
- coordinate presence and coordinates when available
- normalized type
- normalized lifecycle state
- grouping key and `road-*` incident key
- suppression boolean and suppression reason
- matched `hazard_cleared` evidence
- whether an older clear appears to suppress a newer flooding report
- active eligibility
- generated incident, unified incident, alert, and marker eligibility evidence

## Explicit Questions Answered

The helper explicitly answers whether:

- flooding rows are being written/loaded into the current runtime snapshot
- flooding rows are being normalized into active hazard shape
- flooding rows are active lifecycle eligible
- flooding rows are suppressed by `hazard_cleared` / flooding-cleared records
- the `flooding` type is supported through normalization, lifecycle, active incident generation, alerts, and markers
- coordinates and road identity are present after normalization
- the likely disappearance stage is before active incident generation, during unified incident conversion, or in alert/marker eligibility
- the most likely root cause in the current runtime snapshot is cleared-row suppression, coordinate loss, type support, lifecycle state, or another row-level condition

## Manual Validation

1. Report flooding on FM 1960.
2. Wait until the flooding report disappears from active incidents, alerts, and markers.
3. Run:

```js
window.gridlyFloodingActiveIncidentPipelineAudit?.()
```

Review `rows[].suppressionReason`, `rows[].matchedToHazardCleared`, `rows[].matchedClearIsOlderThanFlooding`, `likelyFailureStage`, and `likelyRootCause` first.

## Merge Recommendation

Merge as an audit-only diagnostic milestone. Do not implement behavioral fixes until V342 output from a reproduced FM 1960 disappearance identifies the failure stage and root cause.
