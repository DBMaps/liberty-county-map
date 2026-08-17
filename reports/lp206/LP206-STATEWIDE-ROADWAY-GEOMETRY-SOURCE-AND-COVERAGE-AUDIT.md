# LP206 — Statewide Roadway Geometry Source and Coverage Audit

## Executive conclusion

**Decision: UNRESOLVED.** Repository evidence does not prove that the 226 inactive packages are absent. It proves 28 runtime registry entries, 2 locally materialized runtime packages (plus one missing local-runtime target with retained raw source), and 25 Supabase object/manifest references. Bucket listing and identity authentication were unavailable (network proxy returned 403), so the remote count is **unknown**, not zero. No 226-package rebuild is justified yet.

## Statewide accounting

| Measure | Result |
|---|---:|
| Texas counties | 254 |
| Active roadway runtime packages | 28 |
| Missing active runtime coverage | 226 |
| Local runtime packages found | 2 |
| Remote packages verified found | 0 (access unavailable) |
| Supabase package/manifest references | 25 |
| Exact certified local matches | 0 |
| Known uncertified local/reference identities | 27 |
| True missing packages | unknown |
| Runtime linkage missing | 226 |
| Rebuild required | unknown |

## Current 28-county architecture

The production authority is `data/roadway-runtime-manifest.json`, fetched by `GRIDLY_ROADWAY_RUNTIME_MANIFEST_URL` and resolved by `gridlyResolveRoadwayRuntimeSource`. Its 28 keys—not a numeric constant or statewide source-availability flag—are the effective allowlist: 3 local packages, 24 external single-object URLs, and Harris's partition manifest. Missing keys fail closed as `blocked_missing_asset`.

Active county IDs: `liberty-tx`, `montgomery-tx`, `san-jacinto-tx`, `chambers-tx`, `jefferson-tx`, `hardin-tx`, `polk-tx`, `walker-tx`, `orange-tx`, `jasper-tx`, `newton-tx`, `tyler-tx`, `galveston-tx`, `brazoria-tx`, `fort-bend-tx`, `waller-tx`, `austin-tx`, `washington-tx`, `brazos-tx`, `grimes-tx`, `wharton-tx`, `colorado-tx`, `fayette-tx`, `lavaca-tx`, `jackson-tx`, `matagorda-tx`, `calhoun-tx`, `harris-tx`.

Active FIPS: 48015, 48039, 48041, 48057, 48071, 48089, 48149, 48157, 48167, 48185, 48199, 48201, 48239, 48241, 48245, 48285, 48291, 48321, 48339, 48351, 48361, 48373, 48407, 48457, 48471, 48473, 48477, 48481.

## Source and package contract

Retained working source and LP118 identify 2025 Census TIGER/Line county roads. The parameterized extraction convention is `tl_2025_48CCC_roads`; it can address arbitrary FIPS and all counties, but does not prove that owner storage already contains every output. Runtime packages are RFC 7946/WGS84 FeatureCollections of LineString/MultiLineString features. Observed source naming/classification fields are `FULLNAME` and `MTFCC`; legacy package provenance is incomplete.

## Local and remote evidence

Locally materialized runtime packages: liberty-tx (11393784 bytes), san-jacinto-tx (2768932 bytes). Additional TIGER shapefile source directories and OSM directional artifacts are source/review evidence, not interchangeable production packages.

Supabase project `nhwhkbkludzkuyxmkkcj`, bucket `gridly-roadways`, prefix `roadways/` is encoded by the manifest. Direct read-only HTTP checks were denied by the environment proxy, and no listing credential is present. Therefore remote existence, total count, manifests, duplicates, sizes, and hashes remain unknown. Run:

`SUPABASE_URL=https://nhwhkbkludzkuyxmkkcj.supabase.co SUPABASE_SERVICE_ROLE_KEY=<read-capable-key> node tools/lp206/owner-supabase-roadway-inventory.mjs --write reports/lp206/remote-roadway-inventory.owner.json`

## Blockers and controls

- REMOTE_PRESENT_UNCERTIFIED: 25
- LOCAL_PRESENT_UNCERTIFIED: 2
- UNRESOLVED: 227

The required controls (Liberty, Dallas, Harris, Bexar, El Paso, Travis, Grayson, McLennan, Smith, Andrews) are present in the 254-row JSON matrix and cover local, referenced-remote, metro, rural, and inactive-roadway cases. Unknown remote access never becomes `PACKAGE_MISSING` or `SOURCE_REBUILD_REQUIRED`.

## Runtime consumers and transport

Nearest-road/report labels/hazard association and map road context directly consume the active county source. Route Watch and Travel Brief compose that context; DriveTexas has its own official geometry/name pipeline and no separate 28-array was found. Directional OSM evidence is historical/paused. The loader is per-active-county/lazy, so statewide activation need not imply a 254-package initial client payload. Known local bytes total 14162716; average 7081358; median 11393784; largest 11393784; a naïve average projection is 1798664932, explicitly excluding remote/Harris evidence.

## Tooling and next milestone

LP118 can extract arbitrary/all county TIGER sources and LP116 can manufacture candidates, but LP206 did not execute them. Certification capabilities are fragmented; a unified remote identity and 254-package production certificate is missing. The smallest next step is read-only owner inventory and governed identity reconciliation. Only after that evidence can Gridly choose recovery, mixed recovery/build, or rebuild. No runtime, Supabase, package, registry, or consumer file was changed.
