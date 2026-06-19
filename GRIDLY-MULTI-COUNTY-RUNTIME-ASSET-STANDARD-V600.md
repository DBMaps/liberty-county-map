# GRIDLY Multi-County Runtime Asset Acquisition Standard V600

## Objective

V600 defines a repeatable, county-owned runtime asset acquisition standard for every approved next county so future county setup does not repeat the Montgomery source-gap problem. V600 uses the V599 and V599A asset-contract guidance as authoritative and remains a planning/acquisition-readiness milestone only.

## Explicit Non-Goals and Containment

V600 does **not**:

- import source data;
- register assets into runtime;
- activate additional counties;
- reuse Liberty assets;
- modify Supabase;
- resume DriveTexas;
- enable Transportation Intelligence;
- enable historical reads, UI, API, or dashboard behavior.

## Scoped Counties

| County | County slug | State FIPS | County FIPS | Full GEOID |
|---|---:|---:|---:|---:|
| Montgomery County, Texas | `montgomery` | `48` | `339` | `48339` |
| Chambers County, Texas | `chambers` | `48` | `071` | `48071` |
| San Jacinto County, Texas | `san-jacinto` | `48` | `407` | `48407` |
| Polk County, Texas | `polk` | `48` | `373` | `48373` |
| Jefferson County, Texas | `jefferson` | `48` | `245` | `48245` |
| Harris County, Texas | `harris` | `48` | `201` | `48201` |

## Existing Repository Asset Audit

Audit command used for V600:

```bash
find assets data -type f \( -name '*.geojson' -o -name '*.json' \) | sort | rg -i '(montgomery|chambers|san[-_ ]?jacinto|polk|jefferson|harris|crossing|road|override|boundary)'
```

Findings:

| County | Boundary asset already present? | Road asset already present? | Rail crossing asset already present? | Review overrides already present? | Existing relevant paths |
|---|---|---|---|---|---|
| Montgomery | Yes | No | No | No county-owned override file | `assets/county-implementation/montgomery/boundary/montgomery-county-boundary.geojson` |
| Chambers | No | No | No | No | None found |
| San Jacinto | No | No | No | No | None found |
| Polk | No | No | No | No | None found |
| Jefferson | No | No | No | No | None found |
| Harris | No | No | No | No | None found |

Repository-wide Liberty baseline assets exist at `data/liberty-county-boundary.geojson`, `data/liberty-county-road-segments.geojson`, `data/liberty-county-rail-crossings.geojson`, and `data/gridly-crossing-review-overrides.json`. These are not reusable for V600 scoped counties.

## County-Owned File Naming and Path Standard

All future acquired assets for scoped counties should be county-owned and package-scoped under `assets/county-implementation/{county-slug}/runtime-assets/`. They must not be placed under `data/` during acquisition.

Required package per county:

| Asset type | Canonical path pattern | Initial/acquired content requirement |
|---|---|---|
| Boundary | `assets/county-implementation/{county-slug}/runtime-assets/{county-slug}-county-boundary.geojson` | GeoJSON FeatureCollection or single county feature converted to FeatureCollection, WGS84 `[lng, lat]` coordinates, exactly the scoped county |
| Roads | `assets/county-implementation/{county-slug}/runtime-assets/{county-slug}-county-road-segments.geojson` | GeoJSON FeatureCollection of LineString/MultiLineString road features |
| Crossings | `assets/county-implementation/{county-slug}/runtime-assets/{county-slug}-county-rail-crossings.geojson` | GeoJSON FeatureCollection of Point rail crossing features |
| Overrides | `assets/county-implementation/{county-slug}/runtime-assets/{county-slug}-county-crossing-review-overrides.json` | JSON object initialized as exactly `{}` |

Montgomery observation: its existing boundary file predates this standard and currently lives at `assets/county-implementation/montgomery/boundary/montgomery-county-boundary.geojson`. A future acquisition milestone should either copy/normalize it into the canonical `runtime-assets/` path with provenance or explicitly grandfather the existing path in a county manifest. V600 does not move it.

## Public Source Standard

### Boundary Source

Recommended source for missing or normalization-required boundaries:

- U.S. Census Bureau TIGER/Line 2025 County boundary shapefile for Texas, filtered by county `GEOID`.
- Download pattern: `https://www2.census.gov/geo/tiger/TIGER2025/COUNTY/tl_2025_us_county.zip`, then filter `STATEFP=48` and the county `COUNTYFP` / `GEOID`.
- Rationale: Census TIGER/Line is the already accepted public baseline for U.S. county legal boundary geometry and is compatible with the road source family.

### Road Source

Preferred first source for missing road assets:

- U.S. Census Bureau TIGER/Line 2025 All Roads by Texas county.
- Download pattern: `https://www2.census.gov/geo/tiger/TIGER2025/ROADS/tl_2025_{GEOID}_roads.zip`.
- Required conversion: unzip shapefile, convert to GeoJSON, preserve source fields, normalize runtime fields, and validate WGS84 `[lng, lat]` coordinate order.

### Rail Crossing Source

Preferred first source for missing rail crossing assets:

- FRA / U.S. DOT Crossing Inventory Data (Form 71) - Current.
- Dataset endpoint: `https://data.transportation.gov/Railroads/Crossing-Inventory-Data-Form-71-Current/m2f8-22s6`.
- Required filter: `statename=TEXAS` and `countyname={COUNTY}`.
- Required conversion: export filtered rows, convert records with longitude/latitude into Point GeoJSON, preserve stable crossing id and descriptive fields, and quarantine rows with absent or invalid coordinates for review evidence.

## County Asset Matrix and Source Recommendations

| County | Boundary target | Boundary source recommendation | Roads target | Roads source recommendation | Crossings target | Crossing source recommendation | Overrides target | Readiness |
|---|---|---|---|---|---|---|---|---|
| Montgomery | `assets/county-implementation/montgomery/runtime-assets/montgomery-county-boundary.geojson` | Existing package boundary available; future milestone should normalize/copy with provenance or grandfather existing path. | `assets/county-implementation/montgomery/runtime-assets/montgomery-county-road-segments.geojson` | Census TIGER/Line 2025 All Roads `tl_2025_48339_roads.zip` | `assets/county-implementation/montgomery/runtime-assets/montgomery-county-rail-crossings.geojson` | FRA Form 71 Current filtered `statename=TEXAS`, `countyname=MONTGOMERY` | `assets/county-implementation/montgomery/runtime-assets/montgomery-county-crossing-review-overrides.json` | Ready with observation: boundary exists outside canonical path; roads/crossings/overrides missing. |
| Chambers | `assets/county-implementation/chambers/runtime-assets/chambers-county-boundary.geojson` | Census TIGER/Line 2025 County boundary `GEOID=48071` | `assets/county-implementation/chambers/runtime-assets/chambers-county-road-segments.geojson` | Census TIGER/Line 2025 All Roads `tl_2025_48071_roads.zip` | `assets/county-implementation/chambers/runtime-assets/chambers-county-rail-crossings.geojson` | FRA Form 71 Current filtered `statename=TEXAS`, `countyname=CHAMBERS` | `assets/county-implementation/chambers/runtime-assets/chambers-county-crossing-review-overrides.json` | Ready for acquisition; all four package assets missing. |
| San Jacinto | `assets/county-implementation/san-jacinto/runtime-assets/san-jacinto-county-boundary.geojson` | Census TIGER/Line 2025 County boundary `GEOID=48407` | `assets/county-implementation/san-jacinto/runtime-assets/san-jacinto-county-road-segments.geojson` | Census TIGER/Line 2025 All Roads `tl_2025_48407_roads.zip` | `assets/county-implementation/san-jacinto/runtime-assets/san-jacinto-county-rail-crossings.geojson` | FRA Form 71 Current filtered `statename=TEXAS`, `countyname=SAN JACINTO` | `assets/county-implementation/san-jacinto/runtime-assets/san-jacinto-county-crossing-review-overrides.json` | Ready for acquisition; all four package assets missing. |
| Polk | `assets/county-implementation/polk/runtime-assets/polk-county-boundary.geojson` | Census TIGER/Line 2025 County boundary `GEOID=48373` | `assets/county-implementation/polk/runtime-assets/polk-county-road-segments.geojson` | Census TIGER/Line 2025 All Roads `tl_2025_48373_roads.zip` | `assets/county-implementation/polk/runtime-assets/polk-county-rail-crossings.geojson` | FRA Form 71 Current filtered `statename=TEXAS`, `countyname=POLK` | `assets/county-implementation/polk/runtime-assets/polk-county-crossing-review-overrides.json` | Ready for acquisition; all four package assets missing. |
| Jefferson | `assets/county-implementation/jefferson/runtime-assets/jefferson-county-boundary.geojson` | Census TIGER/Line 2025 County boundary `GEOID=48245` | `assets/county-implementation/jefferson/runtime-assets/jefferson-county-road-segments.geojson` | Census TIGER/Line 2025 All Roads `tl_2025_48245_roads.zip` | `assets/county-implementation/jefferson/runtime-assets/jefferson-county-rail-crossings.geojson` | FRA Form 71 Current filtered `statename=TEXAS`, `countyname=JEFFERSON` | `assets/county-implementation/jefferson/runtime-assets/jefferson-county-crossing-review-overrides.json` | Ready for acquisition; all four package assets missing. |
| Harris | `assets/county-implementation/harris/runtime-assets/harris-county-boundary.geojson` | Census TIGER/Line 2025 County boundary `GEOID=48201` | `assets/county-implementation/harris/runtime-assets/harris-county-road-segments.geojson` | Census TIGER/Line 2025 All Roads `tl_2025_48201_roads.zip` | `assets/county-implementation/harris/runtime-assets/harris-county-rail-crossings.geojson` | FRA Form 71 Current filtered `statename=TEXAS`, `countyname=HARRIS` | `assets/county-implementation/harris/runtime-assets/harris-county-crossing-review-overrides.json` | Ready for acquisition; all four package assets missing. |

## V599A Runtime Contract Comparison

### Roads Contract

V599A requirement: roads must be a GeoJSON `FeatureCollection`, each geometry must be `LineString` or `MultiLineString`, coordinates must be `[lng, lat]`, and fields must support road name/ref/class usage.

| Proposed source | Contract comparison | Required acquisition normalization |
|---|---|---|
| Census TIGER/Line 2025 All Roads by county | Source shapefile contains road/path line geometry and TIGER road attributes. It is not already GeoJSON, so raw source does not directly satisfy the runtime contract until converted. | Convert to GeoJSON FeatureCollection; validate only LineString/MultiLineString output; preserve/derive road-name fields from `FULLNAME`, `RTTYP`, `MTFCC`, `LINEARID`, and related TIGER attributes; expose normalized runtime properties such as `roadName`, `roadRef`, `roadClass`, and `sourceId`; verify coordinate order after conversion. |

### Crossings Contract

V599A requirement: crossings must be a GeoJSON `FeatureCollection`, each geometry must be a `Point`, coordinates must be `[lng, lat]`, and fields must include a stable crossing id, road/name, railroad, and city/community fields.

| Proposed source | Contract comparison | Required acquisition normalization |
|---|---|---|
| FRA / U.S. DOT Crossing Inventory Data Form 71 Current filtered to Texas county | Source rows include current crossing inventory records and county/state fields but are not county-owned GeoJSON assets by default. Coordinate availability must be validated per row. | Filter by `statename=TEXAS` and exact `countyname`; map the stable U.S. DOT crossing identifier to `crossingId`; convert longitude/latitude columns to Point `[lng, lat]`; map road/street, railroad, city/community, county, and status fields into runtime properties; quarantine rows missing valid coordinates or stable id; output a GeoJSON FeatureCollection. |

### Overrides Contract

V599A requirement: crossing review overrides must be a JSON object keyed by crossing id and initialized as exactly `{}`.

| Proposed source | Contract comparison | Required acquisition normalization |
|---|---|---|
| Repo-created county override file | No external source is required. | Create `assets/county-implementation/{county-slug}/runtime-assets/{county-slug}-county-crossing-review-overrides.json` with exactly `{}` and no placeholder keys, comments, arrays, metadata envelope, or Liberty-derived content. |

## Acquisition Readiness Decision

V600 is ready for a future acquisition milestone because:

1. Each scoped county has a deterministic package path and file naming standard.
2. Every missing road package has a preferred public source using 2025 Census TIGER/Line All Roads by county.
3. Every missing crossing package has a preferred public source using FRA / U.S. DOT Crossing Inventory Data Form 71 Current filtered by Texas county.
4. The runtime contract gap is explicit: roads and crossings require conversion/normalization before they can satisfy V599A runtime contracts.
5. Override files require no external source and must be initialized as exactly `{}`.
6. V600 does not import, register, activate, migrate, or alter runtime behavior.

Observation: Montgomery has a boundary asset already present, but it is not located under the newly proposed `runtime-assets/` canonical package path. This is not blocking for standard readiness, but the next acquisition milestone should decide whether to normalize that file location or grandfather it through manifest evidence.

## Next Implementation Milestone Recommendation

Recommended next milestone: **V601 — Multi-County Runtime Asset Acquisition Package**.

V601 should be explicitly scoped to acquisition only and should:

1. Create `runtime-assets/` directories for approved counties.
2. Acquire or normalize county boundary GeoJSON files.
3. Download Census TIGER/Line 2025 All Roads county ZIPs and convert them to contract-valid GeoJSON.
4. Export FRA Form 71 Current records filtered by Texas county and convert valid rows to contract-valid crossing GeoJSON.
5. Create county override JSON files initialized as exactly `{}`.
6. Produce per-county provenance manifests and validation reports.
7. Keep all assets package-scoped and unregistered.
8. Avoid Supabase, activation, DriveTexas, Transportation Intelligence, and historical feature changes.

## Final Determination

**MULTI-COUNTY ASSET STANDARD READY WITH OBSERVATIONS**
