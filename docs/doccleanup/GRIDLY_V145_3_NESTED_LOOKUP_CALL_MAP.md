# GRIDLY V145.3 — Nested Lookup Call Map + Index Candidate Audit

## Scope
- Added nested lookup instrumentation for `nestedLookupWork` paths only.
- No runtime optimization or behavior changes were introduced.

## What was added
- New nested lookup telemetry capture with:
  - `functionName`
  - `collectionName`
  - `collectionLength`
  - `lookupType`
  - `callCount`
  - `totalMs`
  - `averageMs`
  - `slowestCallMs`
- New audit payload field exposed by `window.gridlyCommuteIntelligenceAudit()`:
  - `nestedLookupCallMap`
  - Includes:
    - aggregate totals
    - per-function breakdown
    - repeated scan detection
    - `indexCandidateRecommendations`

## Candidate collection indexing recommendations (audit-only)
- `crossings[]` → `crossingById` `Map`
- `reports[]` → `reportById` `Map`
- `hazards[]` → `hazardById` `Map`

## Notes
- Instrumentation is focused on nested lookup operations used by:
  - `resolveNearbyKnownLocation`
  - `resolveNearestRoadName`
- Measurements are collected and aggregated at audit-cycle end.
