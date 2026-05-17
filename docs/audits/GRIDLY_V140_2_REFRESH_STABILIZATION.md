# Gridly V140.2 Refresh Chain Stabilization

## Goal
Establish one authoritative refresh owner while preserving all existing report, hazard, alert, unified incident, and route behavior.

## Authoritative Refresh Owner
`loadSharedReports(reason)` remains the single authoritative owner for post-fetch state updates and view refresh.

It continues to:
- assign `activeHazards`
- assign `activeReports`
- trigger `refreshReportHazardViews(...)`

## Changes Implemented

### 1) Refresh chain ownership stabilized
- Kept `loadSharedReports(reason)` refresh responsibility intact.
- Labeled refresh source by passing `refreshReportHazardViews(\`loadSharedReports:${reason}\`)`.

### 2) Removed duplicate post-submit downstream refresh
- In `runPostSubmitRefreshInBackground(submitAudit, markSubmitStage)`, removed extra `.then(() => refreshReportHazardViews())` after `loadSharedReports("post_submit_refresh")`.
- Result: post-submit flow now refreshes once through `loadSharedReports(reason)`.

### 3) Removed duplicate dev-purge downstream refresh/render calls
- In `window.gridlyDevPurgeRecentRoadHazards(options)`:
  - retained pre-load local refresh (`refreshReportHazardViews("gridlyDevPurgeRecentRoadHazards:pre_load")`)
  - retained authoritative reload (`await loadSharedReports("dev_purge_recent_road_hazards")`)
  - removed redundant trailing calls:
    - `refreshReportHazardViews()`
    - `renderUnifiedIncidents()`
    - `renderRoadHazards()`
- Result: one canonical post-load refresh via `loadSharedReports(reason)`; no duplicate trailing fanout.

### 4) Added passive refresh audit counters
Added `window.gridlyRefreshAudit()` with passive-only counters:
- `totalRefreshCount`
- `refreshSourceCounts`
- `renderCounts`
- `lastRefreshAt` / `lastRefreshIso`

Counters are incremented in `refreshReportHazardViews(source)` for:
- `renderAlerts`
- `renderRoadHazards`
- `renderTrendingCrossings`
- `renderUnifiedIncidents`
- `scheduleRenderCrossings`
- `updateRouteIntelligence`

No polling, listeners, or observers were added.

## Non-Goals Confirmed
No changes were made to:
- Supabase sync architecture
- FRA crossing loading
- Liberty County GeoJSON loading
- routing engine
- Route Watch logic behavior
- saved places
- map bootstrap
- desktop layout
- landscape tactical architecture

No hazard cleanup behavior was added or changed.

## Validation
- `node --check js/app.js` passes.
- Change scope is limited to refresh-chain orchestration and passive diagnostics.

## Manual Verification Checklist
- Tap Map Location
- Use My Location
- Submit report
- Alert rendering
- Unified incident rendering
- Route Watch
- Crossing popup
- Desktop untouched
- Landscape untouched
