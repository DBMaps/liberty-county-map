# LP116 — Arbitrary-County Roadway Geometry Manufacturing

## Startup verification

LP116 began on branch `work` at commit `6a711a68345aeb5ed1fd108ac6de8c441263d77d`. `git status --short --branch` contained only the permitted generated `android/.gradle/`, `android/build/`, and `node_modules/` directories. No applicable `AGENTS.md` was present.

## Authoritative pipeline and bounded parameterization

LP116 reuses the established roadway lineage rather than introducing a runtime builder:

- LP028 defines GeoJSON roadway packages and the production runtime manifest.
- `scripts/lp032-harris-package-builder.mjs` supplies TIGER/Line source identity, WGS84 line extraction, seven-decimal normalization, SHA-256-bound manifests, stable segment IDs, deterministic ordering, and adaptive longest-axis partitions. Its governed targets are 35,000 features or 10 MiB; hard limits are 45,000 features and 20 MiB.
- `data/roadway-runtime-manifest.json` remains the runtime selection authority. LP116 never reads it as permission to activate and never writes it.
- LP033 and the existing runtime/cache tests remain the consumer certification boundary.

The small parameterization is `tools/lp116/manufacture-candidate-roadways.mjs`: it accepts an explicit subset from the maintained 254-county inventory, applies the LP032 identity/normalization/partition concepts to candidate-only county outputs, and exposes a module interface used directly by LP114. It does not shell out.

## Source requirements and arbitrary-FIPS contract

`--source` must name an owner-controlled, authoritative US Census TIGER/Line road export represented as an EPSG:4326 GeoJSON `FeatureCollection`. Records must carry `STATEFP` plus `COUNTYFP`, or a five-digit `GEOID`, `STCYFIPS`, or `CountyCode`. `LINEARID`, `LINEARID10`, or `TLID` is retained as source identity where present. The source file SHA-256 binds every candidate manifest and certification. An optional authoritative EPSG:4326 county polygon GeoJSON supplied with `--boundaries` enables coordinate-by-coordinate containment certification.

The command rejects malformed, duplicate, non-Texas, and inventory-absent FIPS before work. Counties are processed independently. Statuses are `GENERATED`, `RESUMED`, `NOT_APPLICABLE`, `REQUIRES_OWNER_SOURCE`, or `FAILED`; candidate evidence remains explicitly unauthorized. Missing source is `REQUIRES_OWNER_SOURCE`, source parsing/query failure is `FAILED`, and `NOT_APPLICABLE` is emitted only after a successful source query selects no eligible valid line.

## Geometry, containment, identity, and duplicates

Only non-empty `LineString` and `MultiLineString` geometries with at least two finite coordinate positions per line are accepted. Points and polygons are never promoted. Coordinates are normalized to seven decimal places in EPSG:4326. The county filter is fail-closed. When boundaries are supplied, every retained coordinate must be within the requested county polygon; boundary-touching coordinates are accepted, matching the existing inclusive package-boundary convention. Otherwise the authoritative TIGER county identity is the containment authority, matching the county-scoped LP032 source contract.

Stable IDs combine the existing county runtime slug with a SHA-256 digest of source identity and normalized geometry. Output is sorted by that ID. Duplicate stable IDs are suppressed and counted; conflicting county identities are excluded by the FIPS query. Repeated builds produce identical package and manifest bytes because generated timestamps are intentionally absent.

## Packages, partitioning, and certification

Small counties use one `<county>-tx.roadways.candidate.geojson` package. Counties above the governed 35,000-feature or 10-MiB target use deterministic adaptive longest-axis partitions named `<county>-tx-pNNNN`. LP116 reports `SINGLE_PACKAGE`, `PARTITIONED`, `NOT_REQUIRED`, or `FAILED`. The three owner targets are not presumed small: their decision is reported only after authentic source selection.

Outputs are local under `reports/lp116/<fips>/` (or `--reports`):

- `packages/*.roadways.candidate.geojson`
- `candidate-roadway-manifest.json`
- `roadway-certification.json`
- `checkpoint.json`

Certification verifies county and FIPS identity, source hash, EPSG:4326 output, line structure, containment, stable and unique IDs, package sizes and SHA-256 values, feature/package counts, manifest agreement, runtime filename identity, and the inactive authorization boundary. A mere file is never accepted as certification. `--resume` reuses only a nonfailed checkpoint bound to the same source hash; `--force` rebuilds atomically. Delete the selected report directory to clean up candidates.

## LP114 integration and recovery

LP114 calls the LP116 module directly once for its explicit county subset and maps evidence into `roadwayGeometry`, `roadwayManifest`, `roadwayCertification`, and `candidateRoadwayRuntimeIdentity`. New LP114 options are `--roadway-source`, `--roadway-boundaries`, and `--roadway-reports`. Roadway failures are recorded per county without deleting address or crossing results; their failures likewise do not erase roadway checkpoints.

Neither tool contains upload, deployment, Storage, production activation, production-manifest mutation, runtime-selection, cache, or consumer behavior paths. All output metadata fixes `activated`, `productionAuthorization`, `uploadEnabled`, and `deploymentEnabled` to `false`.

## Authentic owner execution

The repository does not contain the owner-controlled statewide TIGER/Line export for Burleson, Trinity, and Victoria, so controlled fixtures certify implementation behavior but are **not** authentic county results. Run this exact PowerShell block from the repository root, replacing the two source paths with the governed owner files:

```powershell
$ErrorActionPreference = 'Stop'
$Roadways = 'C:\GridlyOwnerSources\TIGER2025\texas-county-roads.geojson'
$Boundaries = 'C:\GridlyOwnerSources\TIGER2025\texas-counties.geojson'
node .\tools\lp116\manufacture-candidate-roadways.mjs --fips 48051,48455,48469 --candidate --source $Roadways --boundaries $Boundaries --resume --reports .\reports\lp116
if ($LASTEXITCODE -ne 0) { throw "LP116 roadway manufacturing failed: $LASTEXITCODE" }
node .\tools\lp114\manufacture-county-bundle.mjs --fips 48051,48455,48469 --skip-addresses --roadway-source $Roadways --roadway-boundaries $Boundaries --roadway-reports .\reports\lp116 --reports .\reports\lp114 --resume
if ($LASTEXITCODE -ne 0) { throw "LP114 bundle integration failed: $LASTEXITCODE" }
Get-Content .\reports\lp116\roadway-manufacturing-report.json
```

Interpret `GENERATED`/`RESUMED` plus certification `PASS` as an inactive review candidate only. `NOT_APPLICABLE` means an authoritative query completed with no eligible geometry. Supply the missing governed file for `REQUIRES_OWNER_SOURCE`; investigate the named source/certification error for `FAILED`. Owner review and a separate production authorization milestone remain mandatory.

## Merge recommendation

Merge LP116 after its new tests and the LP112–LP115 plus roadway runtime, Harris partition, containment, cache, and directional regression suites pass. Do not activate these candidates as part of this merge.
