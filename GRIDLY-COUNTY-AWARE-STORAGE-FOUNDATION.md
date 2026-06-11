# Gridly County-Aware Storage Foundation V1

## Purpose

This foundation prepares Gridly for future multi-county expansion while preserving the current Liberty County beta experience. It adds a central county registry, safe county helpers, backward-compatible report filtering rules, and optional Supabase metadata fields without adding a new county or changing visible user behavior.

## Current default county

- Default county id: `liberty-tx`
- Display name: Liberty County
- State: `TX`
- Default city anchor: Dayton

If a county id is missing, blank, invalid, or unknown, runtime helpers normalize it back to `liberty-tx`.

## County registry model

The runtime registry is intentionally small and currently contains only Liberty County:

```js
GRIDLY_COUNTY_REGISTRY = {
  "liberty-tx": {
    id: "liberty-tx",
    name: "Liberty County",
    state: "TX",
    defaultCity: "Dayton",
    boundaryPath: "data/liberty-county-boundary.geojson",
    crossingsPath: "https://data.transportation.gov/resource/m2f8-22s6.geojson?$limit=5000&statename=TEXAS&countyname=LIBERTY",
    roadSegmentsPath: "data/liberty-county-road-segments.geojson",
    crossingOverridesPath: "data/gridly-crossing-review-overrides.json"
  }
}
```

The active county remains `liberty-tx`. No UI selector or new county is introduced in this foundation pass.

## Static data folder recommendation

Recommended future layout:

```text
data/counties/liberty-tx/
  boundary.geojson
  rail-crossings.geojson
  road-segments.geojson
  crossing-overrides.json
```

The current production paths are preserved to avoid risky data moves, especially for the large road-segment GeoJSON. The registry includes planned static folder/path metadata so future county data can be added deliberately without breaking Liberty County URLs.

## Supabase `county_id` strategy

New report and feedback writes prepare optional metadata:

- `county_id: "liberty-tx"`
- `state: "TX"`

A Supabase migration adds nullable `county_id` and `state` columns to `public.reports` and `public.gridly_feedback` if those tables exist. Client inserts also include a schema-cache-safe fallback: if a deployed database has not received the new nullable columns yet, the client retries the insert without county metadata so report sync continues to work.

## Backward compatibility rules

- Existing report rows with no `county_id` are treated as `liberty-tx`.
- Rows with `county_id === "liberty-tx"` display in the current Liberty County experience.
- Rows with unknown or non-active county ids are hidden from the active Liberty County view.
- The active county helper defaults to `liberty-tx` when missing or invalid.
- No destructive data migration is performed.

## LocalStorage migration warning

Existing localStorage keys are preserved. A helper now exists for future keys:

```js
gridlyBuildCountyStorageKey(baseKey, countyId)
```

`gridlyEventHistoryV1` is currently global. It should not be destructively migrated during the Liberty beta. If a multi-county beta begins, migrate event history with a deliberate compatibility plan that reads the global key first and writes county-scoped keys only after validation.

## Hardcoded Liberty assumption findings

A repository search still finds intentional Liberty County assumptions in documentation, current UI copy, static-data filenames, awareness-area fallback logic, and TxDOT/FRA filtering. These are expected for this foundation pass because the Liberty County beta behavior must remain unchanged and no new county is being added. The new registry centralizes the primary runtime static-data paths, while deeper user-facing copy and awareness-area behavior should remain Liberty-specific until a future county is actually introduced.

## Runtime audit

Run this in the browser console after the app loads:

```js
window.gridlyCountyStorageReadinessAudit?.()
```

Expected readiness fields include:

- `available: true`
- `activeCountyId: "liberty-tx"`
- `activeCountyKnown: true`
- `libertyDefaultProtected: true`
- `reportCountyFallbackProtected: true`
- `staticCountyPathsConfigured: true`
- `supabaseCountyMetadataPrepared: true`
- `localStorageMigrationDeferred: true`
- `safeToAddNextCounty: true`

## Future next-county checklist

Before adding another county:

1. Add the county to `GRIDLY_COUNTY_REGISTRY` with a stable id, state, default city, and reviewed static data paths.
2. Add static data under `data/counties/<county-id>/` or update the registry to a verified external source.
3. Confirm Supabase migrations have nullable `county_id` and `state` columns deployed.
4. Confirm readers filter by active county and preserve missing-`county_id` Liberty fallback behavior.
5. Create a non-destructive localStorage migration plan for global keys such as `gridlyEventHistoryV1`.
6. Add county-specific QA fixtures or manual browser tests.
7. Run `window.gridlyCountyStorageReadinessAudit?.()` and verify `safeToAddNextCounty` remains true before enabling any visible county selection.
