# LP206 — Statewide Roadway Geometry Source and Coverage Audit

## Closure decision

LP206 freezes **28 existing governed/runtime counties** and the exact **226-county missing-cohort roadway manufacturing** boundary. Statewide roadway geometry was not previously manufactured.

- **ROADWAY_RUNTIME_GAP:** `MISSING_COHORT_MANUFACTURING_REQUIRED`
- **SOURCE_ACQUISITION:** `NO_EXISTING_ACQUISITION_TOOLING`
- **LP207_READINESS:** `READY_FOR_LP207_PILOT`

Full statewide execution is not ready: a fail-closed downloader and a governed TIGER-to-runtime name/class/source-vintage contract remain required.

## Exact existing 28 / missing 226

The builder derives both sets from `data/lp104/texas-counties.json` minus the keys of `data/roadway-runtime-manifest.json`; no county list is hardcoded. Conservation passes: existing 28, missing 226, intersection 0, union 254, duplicates 0, unknowns 0, omitted Texas counties 0, and non-Texas identities 0. The complete ordered records, including package/transport paths for the 28, are frozen in `statewide-roadway-missing-build-cohort.json`.

## Prior-work reconciliation

LP188.3's 254 files are community identity packages (1,863 places, 2,062 memberships, 163 multi-county places), with zero road-related files. The owner's 26 OSM raw artifacts are historical source inputs; their 228 complement is not this cohort. The six extracted TIGER shapefiles and three newer ZIPs are partial source holdings. Production Supabase contains 29 objects: 24 LP030 county objects, Harris's manifest and four partitions, plus a placeholder. None is a hidden statewide inventory.

## Official source and acquisition

The repository governs U.S. Census Bureau TIGER/Line 2025 All Roads, one ZIP per county: `https://www2.census.gov/geo/tiger/TIGER2025/ROADS/tl_2025_<FIPS>_roads.zip`. Required shapefile data members are SHP, SHX, DBF, PRJ and CPG. LP118 hashes supplied bytes/output and validates identity/geometry, but it does **not download**, check HTTP status, or independently test ZIP integrity. No reusable acquisition script exists; manual curl examples and upload tooling are not download automation.

## Manufacturing and certification

LP118 accepts arbitrary/batched Texas FIPS and owner-supplied ZIP/SHP/GeoJSON, runs GDAL, checks containment and line geometry, rounds coordinates, deduplicates and sorts. LP116 creates inactive candidate packages, adaptive deterministic partitions, manifests, hashes and certification. It has no production apply/upload mode. Existing partition thresholds are 35,000 target/45,000 hard features and 10/20 MiB target/hard bytes.

## Source consistency closure

Historical LP030 work used county OSM raw GeoJSON, while later retained TIGER sources and Harris workflows establish TIGER2025 as the intended missing-cohort source. Both normalize to the runtime line-FeatureCollection envelope, but OSM/TIGER naming and classification semantics are materially different. LP207 may pilot TIGER, but must govern the source-vintage/name/class mapping and grandfather the untouched 28 before statewide execution.

## ZIP controls and pilot

LP120 owner rerun evidence shows Lee (48287), Milam (48331), and Robertson (48395) ZIP identity/preflight and candidate roadway manufacturing/certification passed. They are the recommended LP207 pilot controls. Dallas (48113), which is missing from runtime, is the later scale control; do not acquire it yet.

## Transport and protection

LP207 should manufacture and certify local candidates first, publish remotely only after certification, and preserve lazy per-county retrieval. Partition only above established thresholds. The cohort subtraction excludes all current 28, forbids overwrite, and preserves their identities, Harris's four-part structure, and Liberty/San Jacinto local behavior.

## Audit-only attestation

No production runtime file was modified; no roadway package was manufactured; no source file was downloaded; and no Supabase write occurred. Statewide roadway coverage remains incomplete.
