# San Antonio SA Tomorrow two-polygon defect audit

**Status:** `OWNER_EXECUTION_REQUIRED`

The environment does not contain the owner-certified source or GDAL 3.13.0, and could not resolve the City service host. Exact validity reasons, MakeValid measurements, GlobalIDs, and geometry comparisons therefore remain deliberately unasserted rather than inferred.

## Preserved certified findings

| City name | Source mi² | Original calculated mi² | Projected status | Preserved observation |
|---|---:|---:|---|---|
| Far Southwest | 23.12700182 | 28.432135320718697 | INVALID | Material source/calculated discrepancy; owner review required |
| West Northwest | 39.40309223 | 39.43385203383007 | INVALID | Centroid is outside; area values are relatively close |

These provisional classifications are intentionally independent. They must be replaced by measurements from the deterministic owner run: Far Southwest is `OWNER_REVIEW_REQUIRED` / `REQUIRE_CITY_SOURCE_CLARIFICATION`; West Northwest is `SOURCE_GEOMETRY_INVALID_BUT_STABLE` / `KEEP_ORIGINAL_WITH_DOCUMENTED_EXCEPTION`.

## Exact owner PowerShell command

```powershell
$env:GRIDLY_GDAL_BIN = 'C:\Program Files\QGIS 3.44.11\bin'
npm run audit:san-antonio-two-polygon-defects -- --source 'C:\GitHub\Gridly-Source-Data\SanAntonio\SATomorrow\SATomorrowSubAreaPlans-CoSAGIS-Opendata.geojson' --current-url '<EXPLICIT_CURRENT_LAYER_0_QUERY_GEOJSON_URL>' --second-url '<EXPLICIT_UPDATED_LAYER_11_QUERY_GEOJSON_URL>'
```

The URL arguments must be explicit GeoJSON query URLs supplied by the owner. The tool performs no service rediscovery.

## Governance boundaries

No governed geometry was replaced. No consolidation occurred. No consumer region or consumer name was created. Runtime, `js/app.js`, awareness areas, semantic camera behavior, and Houston were not modified.

Design note only: `GOVERNED_ATOMIC_GEOGRAPHY != CONSUMER_REGION_LABEL`.
