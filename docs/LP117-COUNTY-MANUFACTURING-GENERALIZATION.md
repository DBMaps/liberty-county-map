# LP117 — County Manufacturing Generalization

## Startup verification

Work began on branch `work` at `024c2b9008fe766d2228fffd8df8a66b5dfb34f3`. The only startup-status entries were the permitted untracked `android/.gradle/`, `android/build/`, and `node_modules/` directories. No applicable `AGENTS.md` was present.

## Existing pipelines reused and parameterized

LP114 remains the bundle orchestrator. LP117 connects its maintained 254-county identity selection to the authoritative statewide Census boundary package, the Community-Packages governed inventory, LP051 ZIP/county source evidence, LP115 crossing manufacturing, LP116 roadway normalization/certification, LP104 address manufacturing/certification, LP107 runtime certificates, and inactive CountyPromotion-style prerequisite metadata.

The LP117 adapter accepts explicit FIPS, extracts exactly one EPSG:4326 boundary, optionally filters a county-specific or statewide roadway GeoJSON by FIPS and boundary containment, preserves every ZIP/county relationship, and writes deterministic candidate community, destination, and search evidence. It does not infer community names or destinations. Community coordinates and curated destinations therefore remain `REVIEW_REQUIRED` unless governed source records support them.

## LP114 asset integration

LP114 now reports `countyBoundary`, `roadwaySource`, `roadwayGeometry`, `roadwayManifest`, `roadwayCertification`, `communityLocality`, `zipCoverage`, `curatedDestinations`, `searchCoverage`, and `countyPromotionMetadata`, in addition to its address, crossing, checkpoint, and candidate-runtime evidence. Failures and review gates are isolated per asset. `NO_EXISTING_PIPELINE` is no longer used for connected families.

## Authentic checked-in three-county result

The checked-in statewide Census boundaries and HUD/USPS ZIP crosswalk authentically support Burleson (48051), Trinity (48455), and Victoria (48469). Boundary and ZIP candidates are generated. Owner roadway, TxGIO address, and FRA crossing sources remain `REQUIRES_OWNER_SOURCE` when their command arguments or existing packages are unavailable. Community/locality coordinates, curated destinations, and consequent search coverage remain `REVIEW_REQUIRED`; empty governed candidates are emitted rather than invented data.

## Candidate hierarchy, recovery, and statuses

Outputs live below the requested `--reports` directory, one directory per FIPS, plus the LP114 bundle report. `--resume` safely rewrites deterministic evidence and reports `RESUMED`. Delete the selected candidate report directory to clean up; no production directory is touched.

Allowed statuses are `GENERATED`, `RESUMED`, `VERIFIED_EXISTING`, `NOT_APPLICABLE`, `REQUIRES_OWNER_SOURCE`, `REVIEW_REQUIRED`, `FAILED`, and `NOT_AUTHORIZED`. Missing external data is never reported as not applicable.

## Owner command

```powershell
node .\tools\lp114\manufacture-county-bundle.mjs `
  --fips 48051,48455,48469 `
  --resume `
  --gdb 'C:\GitHub\Gridly-Source-Data\TxGIO\Texas.gdb' `
  --crossing-source 'C:\GitHub\Gridly-Source-Data\FRA\railroad-crossings.geojson' `
  --roadway-source 'C:\GitHub\Gridly-Source-Data\OpenStreetMap\Community-Packages\texas-roads-raw.geojson' `
  --roadway-boundaries '.\assets\boundaries\texas-counties-boundaries.geojson' `
  --reports '.\reports\lp117'
```

## Production boundary and merge recommendation

Every LP117 manifest is inactive and carries false production authorization, activation, upload, and deployment flags. LP117 does not modify runtime selection, consumer behavior, active manifests, or production packages. Merge is recommended after owner-source execution and human review of community and destination candidates; production promotion remains a separate governed decision.
