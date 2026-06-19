# GRIDLY Manual Multi-County Asset Acquisition Instructions — V601

## 1. Executive Summary

V601 is a documentation-only manual acquisition package for obtaining every required county-owned runtime asset for the approved future counties listed in V600. It exists because V600.5 determined that the current Codex execution environment cannot directly download the required Census or FRA assets, even though the sources remain public, appropriate, and contract-compatible after conversion.

Authoritative references used:

- `GRIDLY-MONTGOMERY-ASSET-ACQUISITION-PLAN-V599.md` for the V599A runtime contract summary and Montgomery source precedent.
- `GRIDLY-MULTI-COUNTY-RUNTIME-ASSET-STANDARD-V600.md` for county scope, canonical paths, naming standards, and public-source standards.
- `GRIDLY-MULTI-COUNTY-ASSET-ACQUISITION-CAPABILITY-AUDIT-V600.5.md` for the manual-acquisition requirement and current-environment blockers.

This milestone does **not** modify code, register assets, activate counties, modify Supabase, resume DriveTexas, enable Transportation Intelligence, or enable historical reads, UI, API, or dashboard behavior.

Final determination: **READY FOR MANUAL ACQUISITION WITH OBSERVATIONS**.

Observation: Montgomery County already has a boundary asset in `assets/county-implementation/montgomery/boundary/montgomery-county-boundary.geojson`, but V600 requires a canonical runtime package copy or normalized equivalent at `assets/county-implementation/montgomery/runtime-assets/montgomery-county-boundary.geojson` before V602 readiness.

## 2. County Reference Table

| County | County slug | State FIPS | County FIPS | GEOID | Boundary final Gridly filename | Roads final Gridly filename | FRA crossings final Gridly filename | Overrides final Gridly filename |
|---|---|---:|---:|---:|---|---|---|---|
| Montgomery County, Texas | `montgomery` | `48` | `339` | `48339` | `montgomery-county-boundary.geojson` | `montgomery-county-road-segments.geojson` | `montgomery-county-rail-crossings.geojson` | `montgomery-county-crossing-review-overrides.json` |
| Chambers County, Texas | `chambers` | `48` | `071` | `48071` | `chambers-county-boundary.geojson` | `chambers-county-road-segments.geojson` | `chambers-county-rail-crossings.geojson` | `chambers-county-crossing-review-overrides.json` |
| San Jacinto County, Texas | `san-jacinto` | `48` | `407` | `48407` | `san-jacinto-county-boundary.geojson` | `san-jacinto-county-road-segments.geojson` | `san-jacinto-county-rail-crossings.geojson` | `san-jacinto-county-crossing-review-overrides.json` |
| Polk County, Texas | `polk` | `48` | `373` | `48373` | `polk-county-boundary.geojson` | `polk-county-road-segments.geojson` | `polk-county-rail-crossings.geojson` | `polk-county-crossing-review-overrides.json` |
| Jefferson County, Texas | `jefferson` | `48` | `245` | `48245` | `jefferson-county-boundary.geojson` | `jefferson-county-road-segments.geojson` | `jefferson-county-rail-crossings.geojson` | `jefferson-county-crossing-review-overrides.json` |
| Harris County, Texas | `harris` | `48` | `201` | `48201` | `harris-county-boundary.geojson` | `harris-county-road-segments.geojson` | `harris-county-rail-crossings.geojson` | `harris-county-crossing-review-overrides.json` |

## 3. Boundary Acquisition Instructions

Use the U.S. Census Bureau TIGER/Line 2025 national county boundary shapefile and filter it to each scoped Texas county.

Exact public source: U.S. Census Bureau TIGER/Line 2025 `COUNTY` shapefile directory.

Exact download URL for all counties:

```text
https://www2.census.gov/geo/tiger/TIGER2025/COUNTY/tl_2025_us_county.zip
```

Exact navigation path:

```text
https://www2.census.gov/geo/tiger/TIGER2025/COUNTY/ → tl_2025_us_county.zip
```

Expected downloaded filename for all counties: `tl_2025_us_county.zip`.

Expected extracted shapefile contents for all counties:

```text
tl_2025_us_county.cpg
tl_2025_us_county.dbf
tl_2025_us_county.prj
tl_2025_us_county.shp
tl_2025_us_county.shp.ea.iso.xml
tl_2025_us_county.shp.iso.xml
tl_2025_us_county.shx
```

| County | Exact county identifier | Extracted feature filter | Expected extracted filename | Expected final Gridly path |
|---|---:|---|---|---|
| Montgomery County, Texas | `GEOID=48339`; `STATEFP=48`; `COUNTYFP=339` | Keep exactly one feature where `GEOID = 48339` | `tl_2025_us_county.shp` | `assets/county-implementation/montgomery/runtime-assets/montgomery-county-boundary.geojson` |
| Chambers County, Texas | `GEOID=48071`; `STATEFP=48`; `COUNTYFP=071` | Keep exactly one feature where `GEOID = 48071` | `tl_2025_us_county.shp` | `assets/county-implementation/chambers/runtime-assets/chambers-county-boundary.geojson` |
| San Jacinto County, Texas | `GEOID=48407`; `STATEFP=48`; `COUNTYFP=407` | Keep exactly one feature where `GEOID = 48407` | `tl_2025_us_county.shp` | `assets/county-implementation/san-jacinto/runtime-assets/san-jacinto-county-boundary.geojson` |
| Polk County, Texas | `GEOID=48373`; `STATEFP=48`; `COUNTYFP=373` | Keep exactly one feature where `GEOID = 48373` | `tl_2025_us_county.shp` | `assets/county-implementation/polk/runtime-assets/polk-county-boundary.geojson` |
| Jefferson County, Texas | `GEOID=48245`; `STATEFP=48`; `COUNTYFP=245` | Keep exactly one feature where `GEOID = 48245` | `tl_2025_us_county.shp` | `assets/county-implementation/jefferson/runtime-assets/jefferson-county-boundary.geojson` |
| Harris County, Texas | `GEOID=48201`; `STATEFP=48`; `COUNTYFP=201` | Keep exactly one feature where `GEOID = 48201` | `tl_2025_us_county.shp` | `assets/county-implementation/harris/runtime-assets/harris-county-boundary.geojson` |

Manual conversion requirement:

1. Unzip `tl_2025_us_county.zip` locally.
2. Filter to the exact `GEOID` for the county.
3. Export a GeoJSON `FeatureCollection` in WGS84 longitude/latitude coordinate order.
4. Confirm the output contains exactly one county boundary feature.
5. Name the final file exactly as listed above.

## 4. Road Acquisition Instructions

Use the U.S. Census Bureau TIGER/Line 2025 All Roads county shapefile for each county.

Exact public source: U.S. Census Bureau TIGER/Line 2025 `ROADS` shapefile directory.

Exact navigation path:

```text
https://www2.census.gov/geo/tiger/TIGER2025/ROADS/ → tl_2025_{GEOID}_roads.zip
```

| County | Exact Census TIGER/Line road source | County FIPS / GEOID | Exact ZIP filename expected | Exact shapefile contents expected | Expected final Gridly path |
|---|---|---:|---|---|---|
| Montgomery County, Texas | `https://www2.census.gov/geo/tiger/TIGER2025/ROADS/tl_2025_48339_roads.zip` | `48339` | `tl_2025_48339_roads.zip` | `tl_2025_48339_roads.cpg`, `.dbf`, `.prj`, `.shp`, `.shp.ea.iso.xml`, `.shp.iso.xml`, `.shx` | `assets/county-implementation/montgomery/runtime-assets/montgomery-county-road-segments.geojson` |
| Chambers County, Texas | `https://www2.census.gov/geo/tiger/TIGER2025/ROADS/tl_2025_48071_roads.zip` | `48071` | `tl_2025_48071_roads.zip` | `tl_2025_48071_roads.cpg`, `.dbf`, `.prj`, `.shp`, `.shp.ea.iso.xml`, `.shp.iso.xml`, `.shx` | `assets/county-implementation/chambers/runtime-assets/chambers-county-road-segments.geojson` |
| San Jacinto County, Texas | `https://www2.census.gov/geo/tiger/TIGER2025/ROADS/tl_2025_48407_roads.zip` | `48407` | `tl_2025_48407_roads.zip` | `tl_2025_48407_roads.cpg`, `.dbf`, `.prj`, `.shp`, `.shp.ea.iso.xml`, `.shp.iso.xml`, `.shx` | `assets/county-implementation/san-jacinto/runtime-assets/san-jacinto-county-road-segments.geojson` |
| Polk County, Texas | `https://www2.census.gov/geo/tiger/TIGER2025/ROADS/tl_2025_48373_roads.zip` | `48373` | `tl_2025_48373_roads.zip` | `tl_2025_48373_roads.cpg`, `.dbf`, `.prj`, `.shp`, `.shp.ea.iso.xml`, `.shp.iso.xml`, `.shx` | `assets/county-implementation/polk/runtime-assets/polk-county-road-segments.geojson` |
| Jefferson County, Texas | `https://www2.census.gov/geo/tiger/TIGER2025/ROADS/tl_2025_48245_roads.zip` | `48245` | `tl_2025_48245_roads.zip` | `tl_2025_48245_roads.cpg`, `.dbf`, `.prj`, `.shp`, `.shp.ea.iso.xml`, `.shp.iso.xml`, `.shx` | `assets/county-implementation/jefferson/runtime-assets/jefferson-county-road-segments.geojson` |
| Harris County, Texas | `https://www2.census.gov/geo/tiger/TIGER2025/ROADS/tl_2025_48201_roads.zip` | `48201` | `tl_2025_48201_roads.zip` | `tl_2025_48201_roads.cpg`, `.dbf`, `.prj`, `.shp`, `.shp.ea.iso.xml`, `.shp.iso.xml`, `.shx` | `assets/county-implementation/harris/runtime-assets/harris-county-road-segments.geojson` |

Manual conversion requirement:

1. Download the exact county ZIP.
2. Unzip it locally.
3. Convert the county road shapefile to GeoJSON.
4. Preserve source fields such as `LINEARID`, `FULLNAME`, `RTTYP`, and `MTFCC` when present.
5. Validate that all features are `LineString` or `MultiLineString`.
6. Name the final file exactly as listed above.

## 5. FRA Acquisition Instructions

Use the Federal Railroad Administration / U.S. DOT Crossing Inventory Data (Form 71) - Current dataset.

Exact FRA source:

```text
https://data.transportation.gov/Railroads/Crossing-Inventory-Data-Form-71-Current/m2f8-22s6
```

Exact Socrata export pattern:

```text
https://data.transportation.gov/resource/m2f8-22s6.geojson?$limit=5000&statename=TEXAS&countyname={COUNTY}
```

Expected export format: GeoJSON.

Required state filter value for all counties: `statename=TEXAS`.

| County | Exact county filter value | Exact state filter value | Expected export URL | Expected raw filename | Expected final Gridly path |
|---|---|---|---|---|---|
| Montgomery County, Texas | `countyname=MONTGOMERY` | `statename=TEXAS` | `https://data.transportation.gov/resource/m2f8-22s6.geojson?$limit=5000&statename=TEXAS&countyname=MONTGOMERY` | `fra-m2f8-22s6-texas-montgomery.geojson` | `assets/county-implementation/montgomery/runtime-assets/montgomery-county-rail-crossings.geojson` |
| Chambers County, Texas | `countyname=CHAMBERS` | `statename=TEXAS` | `https://data.transportation.gov/resource/m2f8-22s6.geojson?$limit=5000&statename=TEXAS&countyname=CHAMBERS` | `fra-m2f8-22s6-texas-chambers.geojson` | `assets/county-implementation/chambers/runtime-assets/chambers-county-rail-crossings.geojson` |
| San Jacinto County, Texas | `countyname=SAN JACINTO` | `statename=TEXAS` | `https://data.transportation.gov/resource/m2f8-22s6.geojson?$limit=5000&statename=TEXAS&countyname=SAN%20JACINTO` | `fra-m2f8-22s6-texas-san-jacinto.geojson` | `assets/county-implementation/san-jacinto/runtime-assets/san-jacinto-county-rail-crossings.geojson` |
| Polk County, Texas | `countyname=POLK` | `statename=TEXAS` | `https://data.transportation.gov/resource/m2f8-22s6.geojson?$limit=5000&statename=TEXAS&countyname=POLK` | `fra-m2f8-22s6-texas-polk.geojson` | `assets/county-implementation/polk/runtime-assets/polk-county-rail-crossings.geojson` |
| Jefferson County, Texas | `countyname=JEFFERSON` | `statename=TEXAS` | `https://data.transportation.gov/resource/m2f8-22s6.geojson?$limit=5000&statename=TEXAS&countyname=JEFFERSON` | `fra-m2f8-22s6-texas-jefferson.geojson` | `assets/county-implementation/jefferson/runtime-assets/jefferson-county-rail-crossings.geojson` |
| Harris County, Texas | `countyname=HARRIS` | `statename=TEXAS` | `https://data.transportation.gov/resource/m2f8-22s6.geojson?$limit=5000&statename=TEXAS&countyname=HARRIS` | `fra-m2f8-22s6-texas-harris.geojson` | `assets/county-implementation/harris/runtime-assets/harris-county-rail-crossings.geojson` |

Manual normalization requirement:

1. Export each filtered county dataset as GeoJSON.
2. Confirm the export is a GeoJSON `FeatureCollection`.
3. Confirm every runtime feature has `Point` geometry with valid longitude/latitude coordinates.
4. Preserve the stable U.S. DOT crossing identifier and normalize it to the runtime crossing id field during V602 processing.
5. Quarantine any row missing a stable crossing id or valid coordinates before runtime package finalization.
6. Name the final file exactly as listed above.

## 6. Override Instructions

No external source is required for crossing review override files. Each county must receive a county-owned JSON object initialized as exactly `{}`.

| County | Exact contents | Exact final path |
|---|---|---|
| Montgomery County, Texas | `{}` | `assets/county-implementation/montgomery/runtime-assets/montgomery-county-crossing-review-overrides.json` |
| Chambers County, Texas | `{}` | `assets/county-implementation/chambers/runtime-assets/chambers-county-crossing-review-overrides.json` |
| San Jacinto County, Texas | `{}` | `assets/county-implementation/san-jacinto/runtime-assets/san-jacinto-county-crossing-review-overrides.json` |
| Polk County, Texas | `{}` | `assets/county-implementation/polk/runtime-assets/polk-county-crossing-review-overrides.json` |
| Jefferson County, Texas | `{}` | `assets/county-implementation/jefferson/runtime-assets/jefferson-county-crossing-review-overrides.json` |
| Harris County, Texas | `{}` | `assets/county-implementation/harris/runtime-assets/harris-county-crossing-review-overrides.json` |

The upload package may include an acquisition helper named `county-crossing-review-overrides.json` containing exactly:

```json
{}
```

During V602 packaging, copy or rename that helper to the county-specific final Gridly filename shown above. Do not include comments, placeholder keys, arrays, metadata envelopes, or Liberty-derived content.

## 7. Expected Directory Structure

The manual upload package should use this structure for each county under `assets/county-implementation/{county}/`:

```text
assets/county-implementation/{county}/
├── boundary/
│   ├── tl_2025_us_county.zip
│   ├── tl_2025_us_county.cpg
│   ├── tl_2025_us_county.dbf
│   ├── tl_2025_us_county.prj
│   ├── tl_2025_us_county.shp
│   ├── tl_2025_us_county.shp.ea.iso.xml
│   ├── tl_2025_us_county.shp.iso.xml
│   ├── tl_2025_us_county.shx
│   └── {county}-county-boundary.geojson
└── runtime-assets/
    ├── {county}-county-boundary.geojson
    ├── {county}-county-road-segments.geojson
    ├── {county}-county-rail-crossings.geojson
    └── {county}-county-crossing-review-overrides.json
```

Recommended raw-source staging files, if included in the user upload, should be stored outside final runtime registration paths until V602 validation accepts them:

```text
assets/county-implementation/{county}/runtime-assets/source/
├── tl_2025_{GEOID}_roads.zip
├── tl_2025_{GEOID}_roads.cpg
├── tl_2025_{GEOID}_roads.dbf
├── tl_2025_{GEOID}_roads.prj
├── tl_2025_{GEOID}_roads.shp
├── tl_2025_{GEOID}_roads.shp.ea.iso.xml
├── tl_2025_{GEOID}_roads.shp.iso.xml
├── tl_2025_{GEOID}_roads.shx
├── fra-m2f8-22s6-texas-{county}.geojson
└── county-crossing-review-overrides.json
```

Concrete expected final package paths:

```text
assets/county-implementation/montgomery/boundary/
assets/county-implementation/montgomery/runtime-assets/
assets/county-implementation/chambers/boundary/
assets/county-implementation/chambers/runtime-assets/
assets/county-implementation/san-jacinto/boundary/
assets/county-implementation/san-jacinto/runtime-assets/
assets/county-implementation/polk/boundary/
assets/county-implementation/polk/runtime-assets/
assets/county-implementation/jefferson/boundary/
assets/county-implementation/jefferson/runtime-assets/
assets/county-implementation/harris/boundary/
assets/county-implementation/harris/runtime-assets/
```

## 8. Upload Workflow

### 8.1 Downloading assets manually

1. Download the Census county boundary ZIP once from `https://www2.census.gov/geo/tiger/TIGER2025/COUNTY/tl_2025_us_county.zip`.
2. For each county, download the exact Census roads ZIP listed in Section 4.
3. For each county, open or request the exact FRA Socrata GeoJSON export URL listed in Section 5.
4. Save each FRA export using the expected raw filename listed in Section 5.
5. Create one override helper file per county named `county-crossing-review-overrides.json` with exactly `{}`.
6. Convert each boundary and roads shapefile to GeoJSON using local GIS tooling such as QGIS, GDAL/ogr2ogr, or an equivalent trusted converter.
7. Confirm all final GeoJSON assets are WGS84 GeoJSON `FeatureCollection` files.

### 8.2 Uploading assets back into Codex

1. Compress the prepared `assets/county-implementation/` tree into a single upload archive.
2. Upload the archive to Codex in the next asset-processing milestone.
3. Preserve the directory names and filenames exactly as listed in this document.
4. Do not upload assets into `data/` unless a later milestone explicitly authorizes runtime registration or migration.
5. Do not request Supabase, DriveTexas, Transportation Intelligence, historical reads, UI, API, or dashboard changes as part of the upload.

### 8.3 Validation workflow after upload

After assets are uploaded, V602 should validate but not automatically activate counties unless a separate activation milestone explicitly authorizes it.

Required validation checks:

1. Confirm every scoped county has four final runtime package files.
2. Confirm every boundary file is a GeoJSON `FeatureCollection` containing exactly one feature for the expected `GEOID`.
3. Confirm every roads file is a GeoJSON `FeatureCollection` with only `LineString` or `MultiLineString` geometry.
4. Confirm every FRA crossings file is a GeoJSON `FeatureCollection` with only valid `Point` geometry or a documented quarantine report for invalid rows.
5. Confirm every override file parses as JSON and is exactly `{}`.
6. Confirm no Liberty asset was copied into a future-county runtime package.
7. Confirm no registry file was modified to activate the counties unless separately authorized.
8. Confirm protected runtime flags remain unchanged.

### 8.4 V602 readiness requirements

V602 is ready to begin only when all of the following are true:

- All six county package directories are present.
- Each county has a final boundary GeoJSON file in `runtime-assets/`.
- Each county has a final roads GeoJSON file in `runtime-assets/`.
- Each county has a final rail crossings GeoJSON file in `runtime-assets/`.
- Each county has a final override JSON file in `runtime-assets/` initialized as exactly `{}`.
- Source provenance for Census boundary, Census roads, and FRA crossings is preserved.
- Any conversion tool used is identified in validation evidence.
- Any quarantined FRA records or geometry issues are documented before runtime registration.

## 9. V602 Readiness Checklist

| Requirement | Montgomery | Chambers | San Jacinto | Polk | Jefferson | Harris |
|---|---|---|---|---|---|---|
| Boundary downloaded from Census `tl_2025_us_county.zip` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Boundary filtered to exact GEOID | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Boundary final GeoJSON in `runtime-assets/` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Roads ZIP downloaded from Census TIGER/Line 2025 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Roads converted to valid LineString/MultiLineString GeoJSON | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| FRA county export downloaded as GeoJSON | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| FRA crossings validated as Point GeoJSON | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Override file created with exactly `{}` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| No Liberty fallback or copied Liberty runtime asset | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| No activation, registry mutation, Supabase mutation, DriveTexas resume, Transportation Intelligence enablement, or historical feature enablement | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

## Testing / Evidence

Commands used for this documentation-only milestone:

```bash
pwd && rg --files -g 'AGENTS.md' -g '*V599*' -g '*V600*' -g '*V600.5*' -g 'package.json'
find .. -name AGENTS.md -print
sed -n '1,220p' GRIDLY-MULTI-COUNTY-RUNTIME-ASSET-STANDARD-V600.md
sed -n '1,220p' GRIDLY-MULTI-COUNTY-ASSET-ACQUISITION-CAPABILITY-AUDIT-V600.5.md
sed -n '1,180p' GRIDLY-MONTGOMERY-ASSET-ACQUISITION-PLAN-V599.md
curl -I -L --max-time 20 https://www2.census.gov/geo/tiger/TIGER2025/COUNTY/tl_2025_us_county.zip
curl -I -L --max-time 20 https://www2.census.gov/geo/tiger/TIGER2025/ROADS/tl_2025_48339_roads.zip
curl -I -L --max-time 20 'https://data.transportation.gov/resource/m2f8-22s6.geojson?$limit=1&statename=TEXAS&countyname=MONTGOMERY'
git diff -- GRIDLY-MANUAL-MULTI-COUNTY-ASSET-ACQUISITION-INSTRUCTIONS-V601.md
```

Reference evidence:

- V600 scoped counties, county slugs, FIPS/GEOID values, canonical paths, Census boundary source, Census road source, FRA source, and override standard are taken from `GRIDLY-MULTI-COUNTY-RUNTIME-ASSET-STANDARD-V600.md`.
- Manual acquisition requirement and current environment `403`/missing `ogr2ogr` observations are taken from `GRIDLY-MULTI-COUNTY-ASSET-ACQUISITION-CAPABILITY-AUDIT-V600.5.md`.
- Montgomery public-source precedent and V599A runtime contract summary are taken from `GRIDLY-MONTGOMERY-ASSET-ACQUISITION-PLAN-V599.md`.
- The three direct `curl` checks repeated the V600.5 access limitation in this environment: each Census/FRA endpoint failed with `CONNECT tunnel failed, response 403` before asset transfer.

## Final Determination

**READY FOR MANUAL ACQUISITION WITH OBSERVATIONS**

The required source list, county identifiers, expected filenames, final Gridly filenames, package structure, upload workflow, and V602 readiness requirements are fully specified. The only observation is that Codex direct download remains blocked by the current network/proxy path, so the user must manually acquire and upload the assets or the environment must be remediated before automated acquisition can proceed.
