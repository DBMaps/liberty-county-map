# GRIDLY Montgomery Asset Acquisition Plan — V599

## 1. Purpose

V599 identifies the safest and fastest public-source path for adding Montgomery-owned runtime assets without changing runtime architecture. It uses **V599A County Asset Contract Audit** as the authoritative schema contract and remains a documentation-only acquisition plan.

This plan does **not** import data, create runtime data files, update registry paths, change application code, enable Montgomery activation, reuse Liberty assets, link Liberty fallbacks, modify Supabase, run migrations, resume DriveTexas, enable Transportation Intelligence, or alter historical-system boundaries.

## 2. Protected Boundary Confirmation

The following protected boundaries remain preserved by this documentation-only milestone:

| Boundary | Required state | V599 state |
| --- | --- | --- |
| `historicalReadsEnabled` | `false` | Preserved |
| `historyUiEnabled` | `false` | Preserved |
| `historicalApiExposure` | `false` | Preserved |
| `consumerFacingHistoryDashboard` | `false` | Preserved |
| `DriveTexasPaused` | `true` | Preserved |
| `TransportationIntelligenceEnabled` | `false` | Preserved |

## 3. Current Montgomery Asset State

| Asset domain | Current state | Required ownership posture |
| --- | --- | --- |
| Boundary | Existing and registered | Montgomery-owned boundary remains authoritative for containment. |
| Road segments | `roadSegmentsPath: null` | Must become Montgomery-owned only. Liberty road segments must not be reused or fallback-linked. |
| Rail crossings | `crossingsPath: null`; `localCrossingsPath: null` | Must become Montgomery-owned only. Liberty crossing source must not be reused or fallback-linked. |
| Crossing overrides | `crossingOverridesPath: null` | Must become a Montgomery-owned JSON object keyed by Montgomery crossing id. |

## 4. V599A Runtime Contract Summary

V599A is treated as the authoritative schema contract for the three required assets:

### 4.1 Road Segments Contract

Required runtime asset name:

```text
montgomery-county-road-segments.geojson
```

Required shape:

- GeoJSON `FeatureCollection`.
- Each feature geometry must be `LineString` or `MultiLineString`.
- Coordinates must be WGS84 `[lng, lat]`.
- Properties must preserve usable road identity/classification fields, including road name, road reference/route identifier when available, and road class/type where available.

### 4.2 Rail Crossings Contract

Required runtime asset name:

```text
montgomery-county-rail-crossings.geojson
```

Required shape:

- GeoJSON `FeatureCollection`.
- Each feature geometry must be `Point`.
- Coordinates must be WGS84 `[lng, lat]`.
- Properties must include a stable crossing id, road/name fields, railroad field, and city/community fields when source data provides them.

### 4.3 Crossing Overrides Contract

Required runtime asset name:

```text
montgomery-crossing-review-overrides.json
```

Required shape:

- JSON object.
- Object keys are stable crossing ids.
- Values may be populated later by crossing-review workflow.
- File may safely begin as `{}` when no Montgomery crossing reviews have occurred.

## 5. Recommended Public Source — Montgomery Road Segments

### 5.1 Recommendation

Use the **U.S. Census Bureau TIGER/Line 2025 Montgomery County, Texas All Roads shapefile** as the recommended initial public source for `montgomery-county-road-segments.geojson`.

Primary source record:

- Dataset: `TIGER/Line Shapefile, Current, County, Montgomery County, TX, All Roads`
- Publisher: U.S. Department of Commerce, U.S. Census Bureau, Geography Division
- Current data.gov page: <https://catalog.data.gov/dataset/tiger-line-shapefile-current-county-montgomery-county-tx-all-roads>
- Direct download: <https://www2.census.gov/geo/tiger/TIGER2025/ROADS/tl_2025_48339_roads.zip>
- County identity: Montgomery County, Texas, `48339`
- Published/issued vintage shown by the catalog: 2025
- Catalog last checked by data.gov: 2026-05-06
- License shown by the catalog: <https://creativecommons.org/publicdomain/zero/1.0/>

### 5.2 Why This Is the Safest/Fastest Path

TIGER/Line All Roads is the safest and fastest first acquisition path because it is public, county-specific, directly downloadable, federal, repeatable, license-clear, and already encoded as an all-roads county extract. The catalog explicitly describes the source as an extract from Census MAF/TIGER and states that the All Roads product includes primary, secondary, local neighborhood, rural, city street, ramp, service-drive, alley, private-service, bike/path/trail, walkway, and stairway road/path features. That breadth is suitable for the runtime road resolver because the runtime needs a broad road-segment geometry layer rather than a regulatory road-ownership layer.

A Montgomery County / MCECD road-centerline source was found and may be a later quality-enhancement candidate, but it is less safe as the first path because its public access/export stability and license posture need a separate evidence review. TIGER/Line is therefore recommended for V599 implementation sequencing.

### 5.3 Contract Comparison

| V599A road requirement | TIGER/Line All Roads posture | Result |
| --- | --- | --- |
| GeoJSON `FeatureCollection` | Source is shapefile ZIP, not native GeoJSON. Conversion through GDAL/ogr2ogr or equivalent is required. | Compatible after conversion. |
| `LineString` / `MultiLineString` | Source is an All Roads linear-feature shapefile. | Compatible, subject to validation after conversion. |
| WGS84 `[lng, lat]` | TIGER/Line road shapefiles are suitable for WGS84 GeoJSON export; conversion must explicitly produce EPSG:4326 GeoJSON. | Compatible after conversion and validation. |
| Road name/ref/class fields | Expected TIGER fields include name and classification-style fields such as `FULLNAME`, `RTTYP`, `MTFCC`, and route/name components depending on the shapefile schema. | Compatible after preserving/normalizing fields. |
| Montgomery-owned only | County-specific ZIP is `tl_2025_48339_roads.zip`. | Compatible. |
| No Liberty fallback | Source is independent Montgomery county extract. | Compatible. |

## 6. Recommended Public Source — Montgomery FRA Rail Crossings

### 6.1 Recommendation

Use the **Federal Railroad Administration / U.S. DOT Crossing Inventory Data (Form 71) — Current** dataset, filtered to Texas and Montgomery County, as the recommended public source for `montgomery-county-rail-crossings.geojson`.

Primary source records:

- FRA Crossing Inventory overview: <https://railroads.dot.gov/railroad-safety/divisions/crossing-safety-and-trespass-prevention/crossing-inventory>
- Dataset: `Crossing Inventory Data (Form 71) - Current`
- Socrata dataset id: `m2f8-22s6`
- Dataset page: <https://data.transportation.gov/Railroads/Crossing-Inventory-Data-Form-71-Current/m2f8-22s6>
- Recommended GeoJSON query pattern:

```text
https://data.transportation.gov/resource/m2f8-22s6.geojson?$limit=5000&statename=TEXAS&countyname=MONTGOMERY
```

### 6.2 Why This Is the Safest/Fastest Path

The FRA page identifies the Crossing Inventory as the U.S. DOT National Highway-Rail Crossing Inventory and describes it as a national database of crossings, including at-grade and grade-separated crossings. It also states that railroads and states use GCIS to update inventory records. This makes the FRA current inventory the safest source for stable crossing ids and crossing attributes, because the runtime crossing layer depends on crossing identifiers rather than only on local map symbology.

The existing Liberty runtime already uses the same data.transportation.gov dataset family for remote FRA crossing acquisition, so using the Montgomery county filter is the lowest-architecture-risk path while still producing a Montgomery-owned local runtime asset. The implementation milestone should download and snapshot the filtered GeoJSON into a Montgomery-owned file rather than leaving Montgomery runtime bound only to a remote endpoint.

### 6.3 Contract Comparison

| V599A crossing requirement | FRA current inventory posture | Result |
| --- | --- | --- |
| GeoJSON `FeatureCollection` | Socrata provides `.geojson` output from `m2f8-22s6`. | Compatible, subject to query validation. |
| Point geometry | FRA crossing inventory is a crossing-location point dataset. | Compatible, subject to validation that every Montgomery feature has Point geometry. |
| WGS84 `[lng, lat]` | Socrata GeoJSON output should emit GeoJSON coordinates in `[longitude, latitude]` order. | Compatible, subject to coordinate-range validation. |
| Stable crossing id | FRA inventory uses assigned U.S. DOT crossing identifiers. | Compatible. |
| Road/name fields | Form 71 current dataset includes crossing/location road-related attributes. | Compatible, subject to normalization into runtime property names. |
| Railroad field | FRA inventory contains railroad/operator attributes. | Compatible, subject to preserving the selected railroad field. |
| City/community fields | FRA inventory generally includes place/community fields such as city/county/state context. | Compatible where populated; allow blank/null when source lacks city/community. |
| Montgomery-owned only | Query filter must be `statename=TEXAS&countyname=MONTGOMERY`. | Compatible after validation. |
| No Liberty fallback | Source is independent Montgomery county query. | Compatible. |

## 7. Crossing Overrides Starting State

`montgomery-crossing-review-overrides.json` should begin as exactly:

```json
{}
```

This is contract-compatible because the overrides contract is a JSON object keyed by crossing id, and no Montgomery crossing review decisions exist yet. Starting with `{}` is safer than copying Liberty overrides because Liberty keys and review decisions are county-owned and must not be reused for Montgomery.

## 8. Exact Acquisition and Conversion Workflow

The next implementation milestone should perform these steps without changing runtime architecture:

### 8.1 Preflight

1. Confirm current branch and clean working tree.
2. Confirm protected runtime flags remain preserved.
3. Confirm Montgomery registry still has the boundary path registered and road/crossing/override paths still null before asset import.
4. Create all outputs under the Montgomery implementation package, not under Liberty-owned `data/` paths unless a separate migration plan explicitly allows a county-scoped static folder.

Recommended target package paths for implementation:

```text
assets/county-implementation/montgomery/roads/montgomery-county-road-segments.geojson
assets/county-implementation/montgomery/crossings/montgomery-county-rail-crossings.geojson
assets/county-implementation/montgomery/crossings/montgomery-crossing-review-overrides.json
```

### 8.2 Road Acquisition

1. Download `tl_2025_48339_roads.zip` from the Census direct download URL.
2. Record source URL, retrieval timestamp, file size, checksum, catalog page, license URL, and vintage in a Montgomery asset provenance note.
3. Convert shapefile to WGS84 GeoJSON:

```bash
ogr2ogr -f GeoJSON -t_srs EPSG:4326 assets/county-implementation/montgomery/roads/montgomery-county-road-segments.geojson /tmp/tl_2025_48339_roads/tl_2025_48339_roads.shp
```

4. Normalize/preserve runtime-useful road properties. At minimum, preserve source fields and derive stable convenience properties if needed:
   - `name` from `FULLNAME` when present.
   - `road_name` from `FULLNAME` when present.
   - `road_ref` from route/name/reference fields when present.
   - `road_class` from `MTFCC` and/or route-type fields.
   - `source` / `source_dataset` metadata for auditability.
5. Validate feature count is greater than zero.
6. Validate every geometry is `LineString` or `MultiLineString`.
7. Validate every coordinate pair is `[lng, lat]`, with longitude in `[-180, 180]` and latitude in `[-90, 90]`.
8. Validate no feature is imported from Liberty-owned runtime assets.
9. Optionally clip or containment-check against the existing Montgomery boundary if the source includes county-edge artifacts; do not use Liberty road data for this check.

### 8.3 FRA Crossing Acquisition

1. Download the filtered GeoJSON query:

```bash
curl -L 'https://data.transportation.gov/resource/m2f8-22s6.geojson?$limit=5000&statename=TEXAS&countyname=MONTGOMERY' -o assets/county-implementation/montgomery/crossings/montgomery-county-rail-crossings.raw.geojson
```

2. Record source URL, retrieval timestamp, query filter, file size, checksum, and dataset metadata URL.
3. Normalize to the runtime crossing contract and write `montgomery-county-rail-crossings.geojson`:
   - Preserve the FRA crossing id as `crossing_id`.
   - Preserve/derive `name` from road/crossing name fields.
   - Preserve/derive `road_name` from the source road/street field.
   - Preserve/derive `railroad` from the source railroad/operator field.
   - Preserve/derive `city` or `community` from source place fields when populated.
   - Preserve source county/state fields for auditability.
4. Validate feature count is greater than zero.
5. Validate every geometry is `Point`.
6. Validate every coordinate is `[lng, lat]` and lies within plausible Montgomery County bounds or within the registered Montgomery boundary, subject to edge tolerance.
7. Validate every feature has a non-empty stable crossing id.
8. Validate crossing ids are unique after normalization.
9. Validate the source filter did not return Liberty County records.

### 8.4 Crossing Overrides Acquisition

1. Create `assets/county-implementation/montgomery/crossings/montgomery-crossing-review-overrides.json` with exactly `{}`.
2. Validate it parses as JSON.
3. Validate the parsed value is a non-array object.
4. Validate it contains no Liberty crossing ids and no copied Liberty review decisions.

### 8.5 Registry Hook-Up After Asset Validation

Only after asset files pass validation should a later implementation change update Montgomery registry paths from `null` to Montgomery-owned package paths and update runtime availability from missing to available. That later hook-up must be covered by county-runtime tests and must not introduce Liberty fallback behavior.

## 9. Validation Commands for the Next Implementation Milestone

Recommended validation commands after data acquisition:

```bash
node -e "const fs=require('fs'); for (const f of ['assets/county-implementation/montgomery/roads/montgomery-county-road-segments.geojson','assets/county-implementation/montgomery/crossings/montgomery-county-rail-crossings.geojson']) { const g=JSON.parse(fs.readFileSync(f,'utf8')); if (g.type !== 'FeatureCollection') throw new Error(f+' is not FeatureCollection'); if (!Array.isArray(g.features) || !g.features.length) throw new Error(f+' has no features'); } console.log('feature collection checks passed');"
```

```bash
node - <<'NODE'
const fs = require('fs');
const roads = JSON.parse(fs.readFileSync('assets/county-implementation/montgomery/roads/montgomery-county-road-segments.geojson', 'utf8'));
const badRoad = roads.features.find((feature) => !['LineString', 'MultiLineString'].includes(feature?.geometry?.type));
if (badRoad) throw new Error(`invalid road geometry ${badRoad.geometry && badRoad.geometry.type}`);
const crossings = JSON.parse(fs.readFileSync('assets/county-implementation/montgomery/crossings/montgomery-county-rail-crossings.geojson', 'utf8'));
const badCrossing = crossings.features.find((feature) => feature?.geometry?.type !== 'Point');
if (badCrossing) throw new Error(`invalid crossing geometry ${badCrossing.geometry && badCrossing.geometry.type}`);
const ids = new Set();
for (const feature of crossings.features) {
  const id = feature?.properties?.crossing_id;
  if (!id) throw new Error('crossing without crossing_id');
  if (ids.has(id)) throw new Error(`duplicate crossing_id ${id}`);
  ids.add(id);
}
const overrides = JSON.parse(fs.readFileSync('assets/county-implementation/montgomery/crossings/montgomery-crossing-review-overrides.json', 'utf8'));
if (!overrides || Array.isArray(overrides) || typeof overrides !== 'object') throw new Error('overrides is not an object');
console.log('geometry/id/override checks passed');
NODE
```

```bash
node tests/county-runtime/montgomeryRuntimeDataSourceIntegrationV598.test.js
```

```bash
rg -n "historicalReadsEnabled: false|historyUiEnabled: false|historicalApiExposure: false|consumerFacingHistoryDashboard: false|DriveTexasPaused: true|TransportationIntelligenceEnabled: false" js tests scripts GRIDLY-*.md
```

## 10. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Census roads are public and complete but may be less locally curated than MCECD centerlines. | Use TIGER/Line as the first implementation-safe baseline; reserve MCECD road centerlines for a later evidence-reviewed enhancement. |
| FRA crossing fields may not match runtime property names exactly. | Normalize into `crossing_id`, `name`, `road_name`, `railroad`, and `city`/`community` while preserving source fields. |
| Remote acquisition may be blocked in some environments. | Record acquisition blocker and retry from an approved network; do not substitute Liberty files. |
| County-edge road/crossing features may sit exactly on shared boundaries. | Validate against Montgomery boundary with an explicit edge tolerance; keep shared-edge handling separate from Liberty fallback. |
| Empty overrides could be mistaken for missing review. | Document `{}` as intentional initial state and require later crossing-review workflow to populate it by crossing id. |

## 11. Final Recommendation

**Proceed.**

Proceed with a dedicated Montgomery asset acquisition implementation milestone using:

1. **Roads:** U.S. Census Bureau TIGER/Line 2025 Montgomery County, Texas All Roads shapefile, converted to WGS84 GeoJSON.
2. **Rail crossings:** FRA / U.S. DOT Crossing Inventory Data (Form 71) Current, filtered to `statename=TEXAS&countyname=MONTGOMERY`, snapshotted to Montgomery-owned local GeoJSON.
3. **Crossing overrides:** Montgomery-owned JSON object initialized as `{}`.

Do not proceed with any path that copies Liberty road segments, reuses Liberty rail crossings, copies Liberty crossing overrides, or relies on Liberty fallback URLs for Montgomery runtime assets.

## 12. Exact Next Implementation Milestone

**V600 — Montgomery Runtime Asset Acquisition and Schema Validation**

Recommended V600 scope:

1. Acquire the Census TIGER/Line Montgomery roads ZIP.
2. Convert it to `montgomery-county-road-segments.geojson` under the Montgomery implementation package.
3. Acquire the FRA current Montgomery rail-crossing GeoJSON filter.
4. Normalize it to `montgomery-county-rail-crossings.geojson` under the Montgomery implementation package.
5. Create `montgomery-crossing-review-overrides.json` as `{}` under the Montgomery implementation package.
6. Add provenance/checksum notes for all three assets.
7. Run schema, geometry, coordinate, uniqueness, ownership, and protected-boundary validations.
8. Do **not** activate Montgomery and do **not** change runtime architecture.

## 13. Testing and Log Commands Used for V599

Commands run during this documentation-only plan:

```bash
pwd && find .. -name AGENTS.md -print
```

```bash
rg -n "V599A|Montgomery|roadSegmentsPath|crossingsPath|crossingOverridesPath|historicalReadsEnabled|DriveTexasPaused|TransportationIntelligence" .
```

```bash
find . -maxdepth 3 -iname '*V599A*' -o -iname '*CONTRACT*AUDIT*' | head -50 && rg -n "County Asset Contract Audit|authoritative schema contract|roadSegmentsPath" --glob '!data/**' .
```

```bash
find . -maxdepth 2 -type f -name 'GRIDLY-*V599*.md' -print && sed -n '1,90p' js/app.js && sed -n '1,80p' docs/GRIDLY-COUNTY-AWARE-STORAGE-FOUNDATION.md
```

```bash
find . -maxdepth 4 -type f | rg 'montgomery|county-runtime|asset|crossing|road' | head -100
```

```bash
sed -n '1,220p' tests/county-runtime/montgomeryRuntimeDataSourceIntegrationV598.test.js && sed -n '1,120p' data/liberty-county-rail-crossings.geojson && head -40 data/gridly-crossing-review-overrides.json
```

```bash
python - <<'PY'
import urllib.request,json
url='https://data.transportation.gov/resource/m2f8-22s6.geojson?$limit=2&statename=TEXAS&countyname=MONTGOMERY'
print(urllib.request.urlopen(url,timeout=20).read(2000).decode())
PY
```

The Python acquisition probe failed with `Tunnel connection failed: 403 Forbidden`, which is treated as an environment access limitation and not as a source rejection.
