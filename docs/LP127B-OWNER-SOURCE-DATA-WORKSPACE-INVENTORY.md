# LP127B — Owner Source-Data Workspace Inventory and Reconciliation

## Decision record

LP127B accepts the four governed owner reports as the authoritative, read-only representation of `C:\GitHub\Gridly-Source-Data`. The source workspace need not be mounted or be a Git repository. Its 521 files are classified `OUTSIDE_GIT_CONTROL`, not as untracked application-repository files. This is an inventory/reconciliation milestone: no source was downloaded, copied, changed, manufactured, activated, or deployed.

**Recommendation:** merge this audit. For the next separately authorized manufacturing milestone, prioritize a TxGIO address expansion for Lee, Milam, and Robertson counties from `Texas-Address-Points/Raw/Texas-2026.gdb`. The source is present, mission-critical, county-attributable, and supported by existing deterministic builders. LP127B does not execute that work.

## Owner input validation

| Check | Result |
|---|---:|
| logical root | `GRIDLY_SOURCE_DATA_REPO` on all 521 records |
| physical files | 521 |
| bytes | 49,056,740,181 (45.688 GB) |
| hashes calculated | 284 |
| Git tracked / ignored | 0 / 0 |
| repository state | `OUTSIDE_GIT_CONTROL` |
| generated UTC | `2026-08-04T00:36:36.3134705Z` |

All inventory paths are relative. No path contains `node_modules`, `.gradle`, build-cache, dependency-cache, or an absolute/temporary root. The JSON is metadata only: it records names, sizes, timestamps, Git observations, and optional hashes; it embeds no original dataset bytes. The four owner reports were not modified.

## Inventory result

The deterministic grouping produces **336 logical datasets**: geodatabase members are grouped at the `.gdb` directory; shapefile sidecars are grouped at the `.shp`; archives and extracted forms remain related but separate; county outputs remain separate from statewide inputs. There are **8 authoritative source snapshots**, **1 governed snapshot**, **139 derived data assets** (137 county and 2 statewide), 96 manifests, 28 certificates, 12 build reports, 38 configuration/tooling records, and 14 unknown assets requiring identity review.

Largest logical holdings are:

1. extracted NAD R23 geodatabase — 35,834,131,949 bytes, `National-Address-Database/extracted/NAD_r23.gdb`;
2. NAD R23 archive — 9,733,944,292 bytes, `National-Address-Database/NAD_r23.zip`;
3. TxGIO/StratMap Texas address geodatabase — 1,715,018,101 bytes, `Texas-Address-Points/Raw/Texas-2026.gdb`;
4. OSM Texas PBF — 707,715,853 bytes, `OpenStreetMap/Regional/texas-260625.osm.pbf`;
5. Harris raw OSM county roads — 183,680,032 bytes;
6. extracted Census county shapefile — 133,290,097 bytes;
7. Census county archive — 83,989,800 bytes.

These assets explain the material blind spot in LP127A: the app-only audit could not see approximately 45.688 GB held outside its repository.

## Family findings

### FRA rail crossings

Status is **PRESENT**. `FRA/Raw/fra-crossings-tx-raw.geojson` is the statewide source snapshot and has an available SHA-256. A test raw snapshot has the same size but a different hash and therefore is not called a duplicate. Processed statewide data occurs in both `FRA/Processed/fra-crossings-tx.geojson` and `Crossing-Packages/Texas/fra-crossings-tx.geojson`; those two owner copies are exact hash duplicates. County review packages, production packages, manifests, and certificates cover the established 28-county workflow. Review packages are treated as superseded for production selection by their production candidates, but neither form should be deleted.

The owner `Crossing-Packages/Texas/fra-crossings-tx.geojson` hash differs from the clearly corresponding LP127A application-repository file. This is a **VERIFIED_MISMATCH**, not evidence of corruption: modified snapshots may differ, and source date/acquisition metadata is insufficient to choose one. Human identity/version review is required before any refresh.

### Addresses: TxGIO and NAD

TxGIO status is **PRESENT**: the previously missing statewide `Texas-Address-Points/Raw/Texas-2026.gdb` exists as a 126-component logical geodatabase (1,715,018,101 bytes). Its components were not hashed, so LP127B does not fabricate a directory hash. Liberty county FGDB, shapefile, and Gridly GeoJSON are derivatives, not statewide originals.

Both NAD forms are **PRESENT**. `National-Address-Database/NAD_r23.zip` has SHA-256 `611dc018fc110f2069a7bfa086559689c1d85ba18818d6efbc2281e34999b4c1`; the extracted `NAD_r23.gdb` is a 35,834,131,949-byte grouped geodatabase without a fabricated whole-directory hash. Archive/extraction equivalence is relational, not an exact-hash assertion. Existing LP104 exploration/query code makes NAD adapter-capable, but source identity should be confirmed before choosing it over TxGIO.

### Roadways and transportation

OSM status is **PRESENT**: `OpenStreetMap/Regional/texas-260625.osm.pbf` has an available SHA-256 and 28 county road extracts demonstrate deterministic county-level processing. It is ready for multi-county orchestration, subject to acquisition/identity review. The inventory does **not identify a TxDOT statewide roadway snapshot**. DriveTexas placeholders, audit reports, Census TIGER county road ZIPs, and OSM extracts do not establish one; status remains `NOT_IDENTIFIABLE_FROM_INVENTORY`, not ecosystem-wide absence.

### Boundaries and communities

Texas county boundaries are **PRESENT** as the hashed Census `tl_2025_us_county.zip`, with an extracted shapefile and county derivatives. Municipal boundaries remain **NOT_IDENTIFIABLE_FROM_INVENTORY**. Populated places are **DERIVED_ONLY**: community manifests/configuration exist, but no confidently identifiable original populated-places snapshot appears. Existing boundary manufacturing can expand county coverage. Community geography requires source-identity review before claiming authoritative statewide coverage.

### Healthcare, education, and parks

No confidently identifiable HHSC, TEA/AskTED, or TPWD original source snapshot occurs in the owner inventory. Each remains `NOT_IDENTIFIABLE_FROM_INVENTORY` / `STILL_NOT_FOUND` for reconciliation purposes. LP126 generated evidence in the application repository does not turn those derivatives into preserved original source snapshots. These are Tier 2 gaps, behind foundational transport/geography.

### Government and public safety

The TCJS `Texas-Public-Safety/TCJS/PopReportCurrent.xlsx` workbook is **PRESENT**, hashed, and ready for the existing jail adapter/builder. LP124 government, LP125 jail, and LP126 evidence outputs remain application-repository manufactured evidence. No confidently identifiable original sheriff-office or emergency-management source appears in the owner filenames; both remain `STILL_NOT_FOUND` without claiming ecosystem-wide absence.

## LP127A reconciliation

Resolved in the owner workspace: TxGIO Texas-2026 statewide geodatabase, NAD R23 archive, NAD R23 extracted geodatabase, OSM Texas PBF, and Census county archive. The owner-workspace-not-mounted limitation is no longer applicable because the committed reports govern this audit. Still unresolved/identity-incomplete: TxDOT statewide roadway, municipal boundaries, original populated places (derived only), HHSC, TEA, TPWD, sheriff, and emergency-management sources.

## Duplicates, supersession, and hashes

The report finds 2 exact duplicate hash groups and 3 same-filename/different-hash groups. It also records archive/extracted relationships for NAD and Census and the review-to-production crossing supersession pattern. Rebuildable outputs are not conflated with unique authoritative inputs. No deletion, move, rename, or consolidation is authorized.

Exactly 284 physical files have `HASH_AVAILABLE`; 237 have `HASH_NOT_CALCULATED`; none reports hash failure. One unambiguous cross-repository comparison is `VERIFIED_MISMATCH` (the processed statewide crossing copy). All other files are `NO_RECORDED_HASH` for cross-repository comparison; LP127B does not assert matches from ambiguous filenames. Hashing gaps are especially material for grouped geodatabases.

## Manufacturing readiness and next wave

Ready for adapters or identity verification: NAD R23, the OSM PBF, Census county boundary source, and TCJS workbook. Existing adapters/builders support FRA and TxGIO. Ready for multi-county/statewide engineering are FRA crossings, TxGIO addresses, Census county boundaries, and OSM roads; readiness is not permission to run manufacturing.

Four alternatives were compared:

| Alternative | Present/hash | Existing tooling | Main limitation |
|---|---|---|---|
| FRA refresh/adjacent expansion | raw file hash available | arbitrary-county and statewide tooling | owner/app processed hash mismatch needs version review |
| **TxGIO address expansion** | statewide GDB present; component hashes unavailable | single/multi-county deterministic builders and certification | generalize governed selection and verify source identity |
| roadway multi-county | OSM PBF hash available | county builder/extractor | add governed multi-county orchestration; TxDOT source absent |
| boundary/community geography | Census archive hash available | boundary orchestration exists | community original source incomplete |

The recommended next wave is **TxGIO address expansion** using exactly `Texas-Address-Points/Raw/Texas-2026.gdb`, targeting Lee, Milam, and Robertson in one governed multi-county run. Use `tools/lp104/build-txgio-address-packages.mjs` with the existing `tools/lp1051/manufacture-gridly-28-address-counties.mjs` pattern; the missing engineering step is generalized governed county selection beyond the prior 28-county configuration. Expected outputs are county JSONL packages, manifests, and certificates. Certification must include byte-identical rebuilds, source identity/hash review, county attribution checks, and per-county certificates. Human review must sample attribution and address quality. Candidate activation, runtime integration, production approval, deployment, and source modification remain prohibited until separately authorized.

## Determinism, protections, and risk

The generator reads only the owner inventory and writes sorted JSON with stable IDs derived from logical root plus relative primary path. Two consecutive executions must be byte-identical. Validation requires 521 physical paths, 49,056,740,181 bytes, 284 available hashes, unique IDs, unique primary paths, and complete required reconciliation rows.

Only LP127B documentation, evidence, governed owner inputs, and the audit-only generator belong in the commit. No runtime, adapter, manufacturer, production manifest, deployment configuration, raw source, dependency, or build directory may be staged. Owner-controlled prerequisites for later work are source identity/acquisition confirmation, acceptance of unavailable geodatabase-wide hashes or a separately authorized hashing run on the mounted workspace, version resolution for the FRA mismatch, human review, certification, and explicit production authorization.

## Deliverables

- `evidence/lp127b/owner-source-data-logical-inventory.json`
- `evidence/lp127b/lp127a-reconciliation-report.json`
- `evidence/lp127b/remaining-source-gap-report.json`
- `evidence/lp127b/source-manufacturing-readiness-report.json`
- `evidence/lp127b/source-duplicate-and-supersession-report.json`
- `tools/lp127b/generate-owner-workspace-audit.py`
