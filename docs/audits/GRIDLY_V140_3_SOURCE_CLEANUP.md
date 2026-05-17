# GRIDLY V140.3 — Source Cleanup for Generated Road Incidents

## Purpose
This change adds a **developer-only cleanup helper** that removes unwanted **Supabase `reports` source rows** that feed generated `road-*` incidents.

It does **not** delete or mutate generated incidents directly.

## Source chain (authoritative)
Supabase reports → `loadSharedReports(reason)` → `activeReports` + `activeHazards` → `getLiveHazardIncidents()` → `getUnifiedIncidents()` → generated `road-*` incidents → `renderUnifiedIncidents()`.

## Helper
`window.gridlyDevPurgeRecentRoadHazards(options)`

### Safety defaults
- `dryRun: true` (default)
- `confirm: true` required for actual delete
- Developer-host guard (`localhost`, `127.0.0.1`, `.local`, empty host)

### Supported options
- `dryRun` (default `true`)
- `radiusMiles`
- `hours`
- `sourceFilter`
- `typeFilter`
- `limit`
- `confirm`

### Filters and protections
By default, helper excludes:
- rail-linked rows (`crossing_id` present)
- `hazard_cleared` rows

Those can only be included when explicitly requested via `typeFilter`.

Also excluded:
- rows older than `hours`
- rows outside `radiusMiles` (when a center is available)

No rows are deleted in dry-run mode.

## Usage examples

### Dry run (recommended first)
```js
await window.gridlyDevPurgeRecentRoadHazards({
  dryRun: true,
  radiusMiles: 25,
  hours: 168,
  sourceFilter: [],
  typeFilter: [],
  limit: 50
});
```

### Confirmed delete
```js
await window.gridlyDevPurgeRecentRoadHazards({
  dryRun: false,
  confirm: true,
  radiusMiles: 25,
  hours: 168,
  sourceFilter: [],
  typeFilter: [],
  limit: 50
});
```

## Dry-run output includes
- `ok`
- `dryRun`
- `candidateCount`
- `candidates` preview
- grouped cluster keys (`getHazardClusterKey()`)
- predicted `road-*` IDs that would disappear
- current `getLiveHazardIncidents().length`
- current `getUnifiedIncidents().filter(id startsWith "road-").length`

## Delete behavior
When `dryRun: false` and `confirm: true`:
1. Delete only matched Supabase `reports` rows.
2. Call canonical refresh: `loadSharedReports("dev_purge_recent_road_hazards")`.
3. Do not trigger extra render fanout.

## Protected systems (unchanged)
- FRA crossing loading
- Liberty County GeoJSON
- routing engine
- Route Watch logic
- saved places
- map bootstrap
- desktop layout
- landscape tactical architecture

## Validation checklist
1. Run dry run and verify:
   - `candidateCount`
   - `candidates`
   - predicted `road-*` IDs
   - grouped cluster keys
2. If correct, run confirmed delete.
3. Then run:
   - `window.gridlyRefreshAudit()`
   - `getLiveHazardIncidents()`
   - `getUnifiedIncidents().filter((item) => String(item.id || "").startsWith("road-"))`
4. Expect:
   - syntax check passes
   - dry run deletes nothing
   - confirmed delete removes only matching source rows
   - one canonical `loadSharedReports` refresh
   - generated `road-*` incidents disappear only when source rows are removed
