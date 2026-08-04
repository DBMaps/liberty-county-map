# LP127A — Texas Statewide Source Inventory Audit

## Decision record

**Milestone:** LP127A
**Baseline:** `939dcbe0ee64a4659073318e32e5e136c845f58d`
**Audit date:** 2026-08-04
**Disposition:** audit evidence only; no acquisition, source mutation, manufacturing, adapter change, runtime activation, deployment, or candidate approval.

Gridly remains an awareness platform first and route-intelligence platform second. This audit therefore establishes what is locally provable before any subsequent manufacturing work.

## Scope and method

The audit inspected the checkout at `GRIDLY_APP_REPO/`, including tracked, untracked, and ignored paths; repository-local `Gridly-Source-Data/`; `Crossing-Packages/`; `Community-Packages/`; `assets/`; `data/` and `data/generated/`; `evidence/`; `tools/`; `tests/`; reports and documentation references. It also searched `/workspace`, `/workspaces`, `/mnt/data`, and repository siblings to depth four. Dependency and build trees (`node_modules/`, `android/.gradle/`, and `android/build/`) and Git internals were excluded from dataset identity and hashing.

No separate mount corresponding to the owner's `C:\GitHub\Gridly-Source-Data` repository was found. The small repository-local `Gridly-Source-Data/Census/` directory was audited, but it is not treated as proof that the separate owner workspace is mounted. Potential holdings of that separate workspace are classified `OWNER_WORKSPACE_NOT_MOUNTED`, never “missing.”

Discovery grouped shapefile sidecars into a logical shapefile record. SHA-256 was calculated for each inventoried file record; grouped shapefiles report the hash of the `.shp` identity file and aggregate bytes/file count for the sidecars. Git identity was evaluated with `git ls-files`, `git ls-files --others --exclude-standard`, `git ls-files --others --ignored --exclude-standard`, and `git check-ignore -v`. The inventory deliberately excludes generic application/configuration JSON unless it is direct dataset evidence, a source, a governed output, a manifest, or a runtime dataset artifact.

## Executive inventory

| Measure | Result |
|---|---:|
| Logical datasets | 175 |
| Authoritative or governed source snapshots | 50 |
| Derived packages, outputs, runtime artifacts, and review artifacts | 118 |
| Manifests/certificates/configuration-only records | 7 |
| Git tracked | 175 |
| Gitignored | 0 |
| Untracked, not ignored | 0 |
| Aggregate logical bytes | 384,960,767 |
| Exact duplicate groups | 29 |

The zero ignored/untracked inventory count does **not** mean ignored data was skipped: all ignored paths were enumerated. The only material ignored/untracked trees present were dependency/build artifacts, while the address packages allowed by `.gitignore` exceptions are tracked. `NAD_r23.zip`, `NAD_r23.gdb/`, and local NAD reports were not present.

### Family counts

| Family | Logical records | Finding |
|---|---:|---|
| Geography | 61 | Statewide county geometry, 28 repository-local Census county extracts, promoted copies, and ZIP sources exist. |
| Rail Crossings | 59 | FRA statewide source, 28 review packages, 28 production candidates, and two manifests exist. |
| Addresses | 31 | 28 county derivatives, two manifests, and the Liberty certificate exist; statewide geodatabase is not present. |
| Transportation and Roads | 17 | County TIGER shapefiles, county runtime geometries, OSM corridor extracts, and runtime manifest exist; no TxDOT statewide roadway snapshot. |
| Government | 2 | LP124 governed identity source and statewide manufactured evidence exist. |
| Public Safety | 2 | LP125 TCJS workbook and statewide jail evidence exist. |
| Communities and Destinations | 2 | LP122 Wave 1 evidence and the prior 28-county configuration exist. |
| Cross-family manufacturing | 1 | LP126 statewide multi-class governed output exists. |

## Largest logical assets

| Bytes | Dataset | Path |
|---:|---|---|
| 67,186,117 | FRA Texas Highway-Rail Crossing Inventory | `GRIDLY_APP_REPO/Crossing-Packages/Texas/fra-crossings-tx.geojson` |
| 57,731,771 | Harris TxGIO address package | `GRIDLY_APP_REPO/data/generated/lp104/txgio-addresses/harris-48201.addresses.jsonl.gz` |
| 35,232,470 | Montgomery roadway runtime geometry | `GRIDLY_APP_REPO/assets/county-implementation/montgomery/runtime-assets/montgomery-roads-raw.geojson` |
| 31,638,244 | Harris TIGER 2025 road shapefile group | `GRIDLY_APP_REPO/assets/county-implementation/harris/runtime-assets/source/tl_2025_48201_roads.shp` |
| 19,857,662 | Montgomery OSM major-road source extract | `GRIDLY_APP_REPO/assets/directional-intelligence/source/osm/montgomery-major-roads-source.geojson` |
| 19,499,721 | Jefferson OSM major-road source extract | `GRIDLY_APP_REPO/assets/directional-intelligence/source/osm/jefferson-major-roads-source.geojson` |
| 14,000,697 | Texas statewide county boundaries | `GRIDLY_APP_REPO/assets/boundaries/texas-counties-boundaries.geojson` |
| 12,845,351 | Fort Bend TxGIO address package | `GRIDLY_APP_REPO/data/generated/lp104/txgio-addresses/fort-bend-48157.addresses.jsonl.gz` |

## Family findings and code connections

### FRA rail crossings

The 67 MB statewide FRA GeoJSON is the strongest ready source: it is authoritative, locally available, statewide, county attributable, already connected to the LP115 arbitrary-county manufacturer and LP126 `rail_crossings` adapter. Twenty-eight review packages and 28 production packages exist. The review packages are classified as superseded candidates—not deleted—because production counterparts exist. The production manifest and review manifest are preserved. Existing runtime crossing tests and package consumers demonstrate integration, but LP127A changes none of them.

### TxGIO addresses

Twenty-eight deterministic county `.jsonl.gz` packages are present and tracked. The manifest records a 12,142,647-record TxGIO 2026 statewide input and hashes for the derivatives. Liberty has a runtime manifest and certificate and is runtime active; the other 27 are manufactured candidates. The referenced `NAD_r23.zip` and extracted `NAD_r23.gdb/` statewide source are absent from accessible locations. This is a **referenced source not found**, not proof of ecosystem-wide absence while the owner workspace is unmounted. Existing LP104 builder/certifier/query tools and LP104–LP106 tests are present.

### Transportation and geography

The repository has several county TIGER 2025 roadway shapefile groups, runtime roadway outputs, OSM-derived corridor source extracts, and a multi-county roadway runtime manifest. These are not a TxDOT statewide roadway network. No locally preserved TxDOT statewide geometry snapshot was found. County geography is comparatively strong: a 14 MB statewide county boundary file, a dated cartographic boundary map, 28 repository-local Census county extracts, and promoted county-owned copies exist. Exact source/runtime boundary pairs account for most duplicate groups. Authoritative municipal boundary and statewide communities/populated-places source snapshots were not found. ZIP/ZCTA source archives and manufactured ZIP evidence are present.

### Government and public safety

LP124 includes a governed Census county-identity source and manufactured statewide county-government evidence. LP125 includes the 4,985,665-byte `PopReportCurrent.xlsx` TCJS source workbook plus statewide county-jail evidence; the existing Yoakum review condition remains review-only. LP126 consumes these through registered adapters. No separately governed statewide sheriff-office or emergency-management-office source snapshot was found.

### Communities and destinations

LP122 Wave 1 governed evidence covers Lee, Milam, and Robertson and is ready for the existing evidence manufacturing architecture. The prior 28-county community manifest exists, but its upstream `OpenStreetMap/Regional/texas-260625.osm.pbf` and `Census/tl_2025_us_county.zip` references are not locally present. The configuration is therefore `SOURCE_IDENTITY_INCOMPLETE`; it is not proof of the sources. Curated county/community outputs remain derivatives rather than authoritative statewide source snapshots.

### Healthcare, education, parks, weather, and hazards

No accessible authoritative HHSC statewide facility file, TEA AskTED/campus/district file, or TPWD park/natural-area/WMA file was found. They are confirmed absent only from **accessible audited locations**; the unmounted owner source-data workspace prevents an ecosystem-wide missing claim. NWS and TxDOT incident connector/configuration references exist, but no preserved statewide source snapshot was identified. Live/configuration references are not raw-dataset possession.

## Duplicates, derivatives, and supersession

The duplicate report contains 29 exact-hash groups. Most are Census county source extracts duplicated into promoted county boundary locations; Liberty roadway and boundary artifacts also have repository copies. These should remain untouched until a separately authorized migration establishes ownership and runtime safety. Review crossing packages have production counterparts and are recommended as superseded for production selection while retained for audit history. Address county packages are derivatives of a referenced statewide geodatabase and must never be presented as the original source.

## Gap classification

### Tier 1 — foundational transportation and geography

* **Present and ready:** FRA statewide crossings; county boundary sources for the existing 28-county footprint.
* **Present only as derivatives:** TxGIO addresses for 28 counties; original statewide geodatabase not found.
* **Referenced source not found:** TxGIO/NAD R23 statewide archive/geodatabase, regional Texas OSM PBF, Census national county ZIP.
* **Confirmed absent from accessible locations:** TxDOT statewide roadway snapshot; authoritative Texas municipal boundaries; authoritative statewide communities/populated places.
* **Owner workspace unknown:** every possible holding of the unmounted separate `Gridly-Source-Data` repository.

### Tier 2 — high-value destinations

HHSC healthcare, TEA schools/districts, and TPWD parks/recreation authoritative source snapshots are absent from accessible locations. No download is recommended by this audit; first mount and audit the owner source workspace.

### Tier 3 — government and public safety

County government and TCJS jail sources/evidence are present and manufactured. Sheriff-office and emergency-management-office statewide source snapshots were not found in accessible locations.

## Readiness

* **Ready for adapter:** the statewide county boundary artifacts (subject to choosing the governed source identity).
* **Adapter exists:** TCJS jail, county government, FRA crossing, TxGIO address derivatives, TIGER roads, and ZIP sources have relevant existing adapters or builders.
* **Ready for manufacturing:** FRA statewide crossings; 28 Census county boundary extracts; LP122 Lee/Milam/Robertson community evidence.
* **Already manufactured:** 28 crossing review/production sets, 28 TxGIO county packages, LP124 government, LP125 jails, and LP126 multi-class output.
* **Runtime active:** Liberty addresses, promoted county boundaries, and roadway assets selected by the existing roadway manifest.

## Recommended next automated wave

Recommend an **FRA deterministic 28-county remanufacturing and certification wave**, followed by a boundary evidence wave for the same footprint.

* **Source:** `GRIDLY_APP_REPO/Crossing-Packages/Texas/fra-crossings-tx.geojson`.
* **Scope:** the existing configured 28 counties; do not imply all 254 counties have been reviewed.
* **Existing tooling:** LP115 arbitrary-county crossing manufacturer, existing package manifests/certificates, LP126 `rail_crossings` adapter, deterministic serializers, and focused tests.
* **Missing tooling:** only an LP127-era governed aggregate orchestration/certificate wrapper if a later milestone requires one.
* **Expected adapters:** existing `rail_crossings`; no adapter modification is needed to begin candidate manufacturing.
* **Expected outputs:** deterministic review packages, production candidates, county certificates, and aggregate report/manifest candidates.
* **Review boundary:** compare source identity, counts, county attribution, hashes, and review overrides; outputs remain candidates.
* **Production boundary:** no approval, production manifest mutation, activation, deployment, or runtime change without a later explicit milestone.

FRA ranks operationally ahead of addresses because its original statewide snapshot is actually present. Address expansion should wait until the owner workspace is mounted and the TxGIO statewide source identity is verified. TxDOT statewide work cannot begin from a preserved statewide source in this checkout.

## Validation and protections

The three JSON deliverables use stable logical root prefixes and are ordered by `(sourceFamily, logicalDatasetName, relativePath)`. Inventory IDs are deterministic hashes of those identity components. Validation checks unique IDs, unique paths, byte totals, sort order, enum classifications, duplicate hash groups, absence of cache/dependency paths, and existence of associated repository paths. Two consecutive generator executions produced byte-identical SHA-256 values for all three reports.

Only this document and `evidence/lp127a/*.json` are intended for the commit. No runtime file, source snapshot, adapter, manufacturer, manifest, deployment configuration, Shared Reports, Route Watch, Awareness Filtering, Hazard Lifecycle, Alert Generation, Supabase Sync, search, address matching, crossing behavior, or county selector was modified. No dataset was downloaded, moved, renamed, normalized, regenerated, or uploaded.

## Owner-controlled prerequisites and risk

1. Mount or otherwise expose the owner's separate `Gridly-Source-Data` workspace and rerun LP127A before declaring ecosystem-wide gaps.
2. Verify the TxGIO/NAD R23 statewide source hash and snapshot identity before any new address manufacturing.
3. Choose one governed statewide/county boundary authority before adapter activation; duplicate physical copies currently encode runtime ownership.
4. Preserve the TCJS workbook and FRA source as unique governed inputs; do not replace their recorded identities silently.
5. Treat all LP127A readiness statements as evidence-based candidate readiness, not approval.

## Deliverables

* `docs/LP127A-TEXAS-STATEWIDE-SOURCE-INVENTORY-AUDIT.md`
* `evidence/lp127a/texas-statewide-source-inventory.json`
* `evidence/lp127a/texas-statewide-source-gap-report.json`
* `evidence/lp127a/texas-statewide-source-duplicate-report.json`
