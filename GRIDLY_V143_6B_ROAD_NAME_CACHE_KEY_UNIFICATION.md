# GRIDLY V143.6b — Road Name Cache Key Unification Audit/Fix

## Audit Summary

`buildRoadHazardDisplay(...)` and `buildLocalizedLocationPhrase(...)` were both doing overlapping road/crossing location resolution work (road candidate extraction, nearest-known lookup, nearest-road resolver usage, and human location context construction) while using separate formatter cache namespaces.

## What Changed

- Added `resolveIncidentRoadLookupPayload(incident)` as a shared resolver for road/crossing lookup primitives.
- Split caching into:
  - `sharedLookupValues` keyed by incident/report identity and geo fallback (`shared_road_lookup::...`).
  - `formatterValues` keyed by helper namespace (`buildRoadHazardDisplay::...`, `buildLocalizedLocationPhrase::...`, etc.).
- Updated `buildRoadHazardDisplay(...)` and `buildLocalizedLocationPhrase(...)` to accept shared resolved payload input while preserving each helper’s own text formatting output.
- Preserved refresh-cycle scope only (cache still initialized and torn down inside `buildCommuteConsequenceIntelligence(...)`).

## Audit Metrics Added

- `sharedRoadLookupCacheHits`
- `sharedRoadLookupCacheMisses`
- `formatterCacheHits`
- `formatterCacheMisses`
- `equivalentLookupReuseDetected`

These are exposed via `window.gridlyCommuteIntelligenceAudit()`.

## Contract Checks

- Final label text: unchanged (formatters untouched in output templates).
- Fallback behavior: unchanged (same fallback ordering and strings).
- Cache lifecycle: unchanged persistence boundary (single refresh cycle).
