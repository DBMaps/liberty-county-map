# GRIDLY V143.6 — Crossing / Road Name Lookup Cache Patch

## Scope
Targeted optimization for repeated crossing/road lookup work inside label helpers:
- `buildLocalizedIncidentLabel`
- `buildCommunityConsequenceLabel`

## Bottleneck confirmed
The expensive lookup sections were already tracked under `crossing_road_name_lookup`, and the repeated helper calls were:
- `buildLocalizedIncidentLabel` -> `buildRoadHazardDisplay(incident)` and `resolveRailLocationText(...)`
- `buildCommunityConsequenceLabel` -> `buildLocalizedLocationPhrase(incident)` (which itself calls `resolveRailLocationText(...)`)

## Patch summary
Added an in-memory **per-refresh** road-name lookup cache that:
- Resets at the start of each `buildCommuteConsequenceIntelligence` run.
- Is torn down at the end of the run to avoid stale cross-refresh reuse.
- Caches by stable incident/report id when available.
- Falls back to cache key by `type + rounded lat/lng + road/crossing key` when id is missing.

## Cache behavior
- Cache key format:
  - `lookupType::id::<stableId>` when id exists.
  - `lookupType::geo::<type>::<lat,lng rounded 4dp>::<road/crossing key>` otherwise.
- Lookup types are separated to preserve output parity across call sites:
  - `buildRoadHazardDisplay`
  - `resolveRailLocationText`
  - `buildLocalizedLocationPhrase`

## Output safety
- Label text is unchanged.
- Fallback paths are unchanged.
- Only redundant work is reduced via memoization within one refresh.

## Audit expansion
`window.gridlyCommuteIntelligenceAudit()` now includes:
- `roadNameLookupCacheActive`
- `roadNameLookupCacheHits`
- `roadNameLookupCacheMisses`
- `roadNameLookupCachedKeys`

## Validation
- Syntax: `node --check js/app.js`
- Manual audit in browser console:
  - `window.gridlyCommuteIntelligenceAudit()`
  - Expect `roadNameLookupCacheHits > 0` on non-trivial incident sets.
