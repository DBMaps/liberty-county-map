# GRIDLY V142.6 — Refresh Render Breakdown Audit

## Scope
Audit-only instrumentation for `refreshReportHazardViews()` to identify child-call timing contributors during post-submit refresh. No optimization, behavior changes, or ownership changes were introduced.

## refreshReportHazardViews timing map
The refresh function now records per-child duration (ms) for:
- `refreshPortraitV2LocalizedIntelligence`
- `renderAlerts`
- `renderRoadHazards`
- `renderTrendingCrossings`
- `renderUnifiedIncidents`
- `scheduleRenderCrossings`
- `updateRouteIntelligence`
- `updateTrustStats`
- `updateGrowthWidgets`
- `updateDailyHabitStatus`
- `updateMobileAlertsMirror`
- `evaluateSmartAlertsBanner`
- `updateLastUpdated`
- `recomputeMovementIntelligence`
- `updateCorridorSummaryCards`

Each refresh also stores total duration plus item-count context in `gridlyRefreshAuditState.recentRefreshes`.

## Slowest child functions
Use:
```js
window.gridlyRefreshBreakdownAudit()
```

Returns:
- `lastRefreshDuration`
- `childDurations`
- `slowestChild`
- `recentRefreshes`
- `recommendedTargets`
- `itemCounts`:
  - `alertCount`
  - `unifiedIncidentCount`
  - `roadHazardCount`
  - `crossingCount`
  - `renderedMarkerCount`
  - `routeIntelligenceState` (`active` / `idle`)

## Likely bottleneck
The instrumentation is intentionally neutral and identifies the bottleneck empirically from `slowestChild` and `childDurations` after a real post-submit cycle.

## Recommended V142.7 patch
1. Focus only on the measured slowest child function.
2. Preserve refresh ownership and ordering.
3. Add isolated optimization behind this audit baseline.
4. Re-run the same post-submit test and compare `recentRefreshes` before/after.

## Protected systems
This audit preserves and does not alter:
- Supabase sync
- report submit behavior
- route logic
- hazard source logic
- crossing data
- desktop/landscape architecture
