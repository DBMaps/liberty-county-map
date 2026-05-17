# GRIDLY V142.8 — Shared Intelligence Calculation Cache

## Duplicated calculations found

During a single `refreshReportHazardViews()` cycle, the same core intelligence pipeline was recomputed in all three hot paths:

- `refreshPortraitV2LocalizedIntelligence()` → `buildUnifiedLocalizedCommuteIntelligence({ limit: 6 })`
- `renderAlerts()` → `buildCommuteConsequenceIntelligence({ limit: 10 })`
- `updateDailyHabitStatus()` → `buildUnifiedLocalizedCommuteIntelligence({ limit: 5 })`

`buildUnifiedLocalizedCommuteIntelligence()` is a direct wrapper around `buildCommuteConsequenceIntelligence()`, so the shared expensive logic includes:

- unified incident filtering and weighting
- route relevance checks (`isIncidentRouteRelevant`)
- corridor clustering and scoring (`buildCorridorClusters`)
- active/corridor/summary consequence message building

## Cache design

A per-refresh in-memory cache is now created at the start of `refreshReportHazardViews()` and discarded at the end of that same cycle.

- Storage: `gridlyRefreshCycleCache.values` (`Map`)
- Accessor: `getGridlyRefreshCycleCachedValue(name, payload, resolver)`
- Key builder: `buildGridlyCacheKey(name, payload)` with sorted payload keys for stable serialization

### Cached function(s)

- `buildCommuteConsequenceIntelligence({ limit })`

### Key parameters currently included

- `limit`
- `routeWatchActivated`
- unified incident count snapshot
- active report count snapshot

These inputs ensure results vary when relevant per-cycle options/state differ, while allowing reuse for identical calls inside the same refresh.

## Invalidation rules

- Cache is initialized on every `refreshReportHazardViews()` call.
- Cache is always torn down in `finally`, even if an intermediate render/update throws.
- No cache entries persist across independent refresh cycles.

## Audit helper expansion

Both helpers now include cache telemetry:

- `window.gridlyPortraitIntelligenceBreakdownAudit()`
- `window.gridlyRefreshBreakdownAudit()`

New fields:

- `intelligenceCacheActive`
- `cacheCycleId`
- `cacheHits`
- `cacheMisses`
- `cachedFunctionNames`

Per-function post-cache timing remains available via existing `sections` and `totalMs` fields for:

- `refreshPortraitV2LocalizedIntelligence`
- `renderAlerts`
- `updateDailyHabitStatus`

## Validation checklist

- [ ] Hard refresh browser
- [ ] Trigger one report submit / refresh cycle
- [ ] Run `window.gridlyPortraitIntelligenceBreakdownAudit()`
- [ ] Run `window.gridlyRefreshBreakdownAudit()`
- [ ] Confirm `cacheHits > 0`
- [ ] Confirm no stale route/alert/status behavior across new refresh cycles
- [ ] Confirm UI output/shape unchanged
