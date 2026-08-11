# LP188.1 — Existing Statewide Source, Package & Supabase Reuse Audit

## 1. Audit boundary and controlling result

This was a read-only audit. It did not acquire data, manufacture packages, mutate Supabase, change runtime code, change county membership, activate or deploy a county, or clear any restriction.

**Final Census/place decision: NO.** The accessible owner source tree contains 28 official 2025 Census **county** geometries, not a Texas place dataset. The older owner-workspace inventory also contains no `PLACE`, `48_place`, place shapefile, or place/county relationship artifact. LP188 therefore remains `STATEWIDE_COMMUNITY_SOURCE_REQUIRED`. The smallest correct acquisition is one preserved official Texas place geometry/source snapshot for a declared vintage. A separate relationship file is optional if memberships are deterministically intersected against matching authoritative county geometry, with all positive-area intersections retained for multi-county places.

**Major reuse decision:** do not rebuild addresses, current roadway assets, or crossings. LP147 records 254 remotely matching immutable address packages and certificates. In particular, all 11 locally missing LP130 payloads have historical remote size and SHA-256 matches and are byte-identical recovery sources, subject to a fresh read-only existence check before recovery. Restrictions remain unchanged.

## 2. Repository identity and inventory method

- The accessible owner path is `Gridly-Source-Data/` inside this checkout (the container representation of `C:\GitHub\Gridly-Source-Data`). It is not an independent Git worktree: `git -C Gridly-Source-Data rev-parse --show-toplevel` resolves to the application repository. All 28 currently accessible source files are tracked by the application repository.
- Application repository: branch `work`, audited commit `4fd6fc40ca024c6191db2bd6ec8db5a462fabcaf`.
- Current source tree: 28 files, 2,769,901 bytes, zero archives; every file is under `Census/`.
- The owner-confirmed directory names not currently mounted are not treated as never having existed. `reports/lp127b-owner-workspace/owner-source-data-file-inventory.{json,csv}` is preserved historical evidence of 521 files across the larger Windows source workspace. It records file paths, byte sizes, tracking state, and selective SHA-256 values.
- Counts and sizes below distinguish **accessible now** from **historically inventoried**. No large source was recursively rehashed.

## 3. Top-level data-family inventory

| Family | Accessible path/state | Historical files / bytes | Type and authority | Coverage | Hash/provenance evidence | Runtime relationship and LP188 reuse |
|---|---|---:|---|---|---|---|
| Audit-Output | absent now | 5 / 598,151 | audit evidence | workspace | one historical hash | validation/reference only |
| Census | present, 28 files / 2,769,901 bytes | 67 / 227,437,119 | official Census-derived county geometry, raw/processed | 28 counties; not statewide | current files safely hashable; historical inventory hashes 64 | authoritative county validation only; no place authority |
| Community-Packages | absent from source mount; present at repository root | 31 / 35,869 historically; 33 / 11,485,207 now | manifests plus limited runtime assets | 28 counties | registry/manifests; little payload hashing | `LEGACY_REFERENCE` for community identity; roads are reusable separately |
| Crossing-Packages | absent from source mount; present at repository root | 144 / 101,460,063 historically; 89 / 99,911,921 now | FRA-derived candidate/production packages, manifests, certifications | 28 county packages plus historical Texas source | extensive historical hashes | `DERIVED_REUSABLE` crossing evidence; locality validation only |
| Documentation | absent now | 4 / 5,047 | documentation/tool guidance | n/a | path provenance | pipeline interpretation |
| DriveTexas | absent now | 1 / 56 | placeholder | none | none | `NOT_RELEVANT` |
| FRA | absent now | 6 / 204,660,710 | official FRA raw/processed source | Texas statewide crossings | raw/processed hashes and manifest | crossing authority, not complete community authority |
| National-Address-Database | absent now | 71 / 45,571,363,633 | NAD R23 raw GDB/ZIP plus 28-county derivatives | national/Texas/28-county artifacts | ZIP/GPKG/report hashes | `PARTIAL_VALIDATION_REUSE`; locality strings are not Census identities |
| NOAA | absent now | 1 / 50 | placeholder | none | none | `NOT_RELEVANT` |
| OpenStreetMap | absent now | 29 / 1,098,449,173 | OSM PBF, roads, rail | Texas source plus 28 road extracts | 28 historical hashes | roads/aliases/validation; not Census place authority |
| Overture-Place | absent now and zero historical files | 0 / 0 | none | none | source-unavailable reports | `NOT_RELEVANT` as an available source |
| Overture-Places | absent now and zero historical files | 0 / 0 | none | none | source-unavailable reports | `NOT_RELEVANT` as an available source |
| Package-Registry | absent now; runtime registry copied under `assets/` | 2 / 34,186 | package ledger/manifests | 28 community + 28 crossing | both historical hashes | reconstructs package-to-manifest only, not full source-to-remote chain |
| Processing | absent now | 1 / 56 | placeholder | none | none | no reusable pipeline in this family |
| Texas-Address-Points | absent now | 126 / 1,847,633,159 | TxGIO/StratMap 2026 statewide raw GDB, Liberty extracts, metadata | Texas statewide | six key hashes, source metadata, LP104 manifest | **PRESERVE**; expensive authoritative address source underlying LP104/LP130 |
| Texas-Public-Safety | absent now | 1 / 4,988,665 | TCJS workbook | Texas | SHA-256 | `NOT_RELEVANT` to places |
| Tools | absent now; related tools in repository `tools/` | 31 / 73,775 | acquisition, processing, packaging, validation tools | county/regional | historical path inventory | reuse packaging logic; no Census place manufacturer found |

Historical bytes are sums of the `byteSize` field in the LP127B owner-workspace inventory and are evidence of the previously observed Windows workspace, not a claim that those bytes are mounted now.

## 4. Critical Census authority check

### Accessible source

- Source: Census TIGER/Line 2025 county geometry, derived GeoJSON.
- Original dataset identity embedded in each file: `tl_2025_us_county`.
- Local files: `Gridly-Source-Data/Census/*-county-2025-wgs84.geojson`.
- Scope: 28 Texas counties; one feature per file; 28 records total.
- Fields: `STATEFP`, `COUNTYFP`, `COUNTYNS`, `GEOID`, `GEOIDFQ`, `NAME`, `NAMELSAD`, `LSAD`, `CLASSFP`, `MTFCC`, `CSAFP`, `CBSAFP`, `METDIVFP`, `FUNCSTAT`, `ALAND`, `AWATER`, `INTPTLAT`, `INTPTLON`; Polygon/MultiPolygon geometry.
- Supports county GEOID and geometry. It does **not** provide `PLACEFP`, place GEOID, incorporated/CDP class, place name, place geometry, or place-to-county relationships.

### Historical source inventory

The historical Census family adds projected copies, `tl_2025_us_county.zip` and extracted shapefile members, plus six county road archives. It still contains no Texas place source. Consequently:

- place record count: **0**;
- incorporated/CDP classification support: **NO**;
- place GEOID support: **NO**;
- place geometry support: **NO**;
- place/county relationship support: **NO**;
- source state: `AUTHORITATIVE_SOURCE_PARTIAL` (county authority present; place authority absent).

## 5. Overture directories

Neither `Overture-Place` nor `Overture-Places` exists in the accessible source mount, and neither has entries in the owner-workspace inventory. Repository LP160.1 manifests consistently say the governed GeoParquet was unavailable. The two names therefore cannot be classified as versions, stages, or duplicates from evidence; they are unpopulated/absent audit targets. The repository contains schema adapters and deterministic query tooling only, not source records.

If recovered later, Overture may be classified as `SUPPLEMENTAL_COMMUNITY_SOURCE`, `VALIDATION_SOURCE`, `ALIAS_SOURCE`, and `UNINCORPORATED_ENRICHMENT_CANDIDATE`. It is not a Census incorporated-place/CDP authority merely by being Overture.

## 6. Community packages and registry

- Root `Community-Packages/`: 28 county manifests, two documents, one county manifest, and Liberty boundary/road payloads; 33 files / 11,485,207 bytes.
- Manifest schema has `packageType`, county, status, boundary/roads/crossings flags, `communities`, road feature count, source manifest, notes, and generation time. The systematic result is that `communities` arrays are empty; most manifests describe road readiness, not manufactured place inventories.
- No package contains Census `PLACEFP`, place GEOID, incorporated/CDP classification, aliases, awareness geometry, or community certification hashes.
- `assets/package-registry/runtime-package-registry.json` registers 28 Community and 28 Crossing manifests and status, but has no source hash, output byte size, Supabase bucket/object, upload status, or certification chain.
- Community package classification: `LEGACY_REFERENCE` for community/place work; `DERIVED_REUSABLE` for the existing road/boundary portions. It is not statewide community manufacturing and is not superseded evidence that should be deleted.

## 7. Address-source and package chain

Trace:

`TxGIO 2026 Statewide Address Points (12,142,647 source records, EPSG:3857)`
→ `tools/lp104/build-txgio-address-packages.mjs` / `tools/lp130/manufacture-remaining-texas-addresses.mjs`
→ 254 deterministic county gzip JSONL packages
→ LP130 package hashes/certification and LP107 runtime certificates
→ LP147 `certified-addresses/lp104/txgio-addresses/*`
→ `county-artifact-storage.mjs` + `gridly-geocode` certified reader.

The compact runtime row has `i,h,r,a,p,z,c,f,x,y,s,u`: stable derived record ID, house/road/full address, locality/postal-place string, ZIP, county name/FIPS, coordinates, source and update. It has no `PLACEFP`, place GEOID, CDP/incorporated type, or place geometry. `p` is a free-text/postal locality and may be blank. County FIPS and coordinates are authoritative/derived address placement evidence, not Census place identity.

Classification: `PARTIAL_VALIDATION_REUSE`. Reuse it for alias discovery, address-to-awareness resolution, and completeness checks after authoritative places exist. Do not use `p` as canonical place identity. The raw TxGIO source and all existing LP104/LP130 artifacts are explicitly **MARKED FOR PRESERVATION; DO NOT REBUILD**.

Local state now has 59 gzip packages (157,520,493 bytes), while the manufacturing manifest and LP147 evidence cover all 254. The local shortage does not erase remote recovery evidence.

## 8. Exact recovery audit for the 11 restricted counties

All object paths are in bucket `certified-addresses`. “Remote known” means LP147's read-only `verify-remote` report recorded `status=matching`, with actual byte size and actual SHA-256 equal to governed expected values. No current credentials were available for a fresh listing, so current existence is `REMOTE_VERIFICATION_REQUIRED`; this audit does not clear restrictions.

| County | Expected LP130 object | Bytes | SHA-256 | Local | Remote known | Size/hash match | Recovery status |
|---|---|---:|---|---|---|---|---|
| Cameron | `lp104/txgio-addresses/cameron-48061.addresses.jsonl.gz` | 5,373,433 | `24ec5d503dd9b9d370b8f6d40116e1ee37d10c48b26354d14f3621793bc7490b` | no | yes | yes/yes | `EXACT_PAYLOAD_RECOVERY_AVAILABLE` |
| Cherokee | `lp104/txgio-addresses/cherokee-48073.addresses.jsonl.gz` | 1,066,374 | `1a92af50ff47ba5c1f7d7555c96c844ef0e39349473d043c138ff30b10829f2d` | no | yes | yes/yes | `EXACT_PAYLOAD_RECOVERY_AVAILABLE` |
| Dallas | `lp104/txgio-addresses/dallas-48113.addresses.jsonl.gz` | 32,972,921 | `354653cea266e863b13f49f28bd4ae76a17ac84b84ae804f50110a8c1ef48953` | no | yes | yes/yes | `EXACT_PAYLOAD_RECOVERY_AVAILABLE` |
| Denton | `lp104/txgio-addresses/denton-48121.addresses.jsonl.gz` | 11,819,588 | `15e99627ae0a0698536881db9499d18b3c324ed7d5d20cbbf02875da99da7b17` | no | yes | yes/yes | `EXACT_PAYLOAD_RECOVERY_AVAILABLE` |
| Ector | `lp104/txgio-addresses/ector-48135.addresses.jsonl.gz` | 2,044,691 | `a1a74ead55eb8e50fa0ebf52fbb664f18ec7b3b55d847a0607d2bc31e14293f9` | no | yes | yes/yes | `EXACT_PAYLOAD_RECOVERY_AVAILABLE` |
| Hudspeth | `lp104/txgio-addresses/hudspeth-48229.addresses.jsonl.gz` | 166,512 | `b8010daa4a0615780e91c4b5c91871808f7328bb6e91e63163553aa729ce92fe` | no | yes | yes/yes | `EXACT_PAYLOAD_RECOVERY_AVAILABLE` |
| Midland | `lp104/txgio-addresses/midland-48329.addresses.jsonl.gz` | 2,879,318 | `88ee7296cce7c9dbd729a2709426a9e5dcc8b3857d567c2c7ba0c2b3c8899600` | no | yes | yes/yes | `EXACT_PAYLOAD_RECOVERY_AVAILABLE` |
| Presidio | `lp104/txgio-addresses/presidio-48377.addresses.jsonl.gz` | 183,109 | `adc34e30fb7c83338e25c04421c3bda0ef73ec809f716b813fbad53305206cce` | no | yes | yes/yes | `EXACT_PAYLOAD_RECOVERY_AVAILABLE` |
| Rusk | `lp104/txgio-addresses/rusk-48401.addresses.jsonl.gz` | 782,267 | `1f13a56fe4f95fd45825f81c0011de2e86bc2d6788f020efed92049429782e74` | no | yes | yes/yes | `EXACT_PAYLOAD_RECOVERY_AVAILABLE` |
| Somervell | `lp104/txgio-addresses/somervell-48425.addresses.jsonl.gz` | 164,537 | `f0c9536c27942ad01390d7a65fe0cb5b5efa22feef63669ee691e6225f1c3ad1` | no | yes | yes/yes | `EXACT_PAYLOAD_RECOVERY_AVAILABLE` |
| Taylor | `lp104/txgio-addresses/taylor-48441.addresses.jsonl.gz` | 2,563,385 | `aaaba945f9368feeabc05c10237331039084d162f69249d8ad33938eb81aafff` | no | yes | yes/yes | `EXACT_PAYLOAD_RECOVERY_AVAILABLE` |

## 9. Roadways

- Runtime manifest: 28 counties. Twenty-seven entries reference public `gridly-roadways/roadways/<county>-tx/lp030-v1/<county>-road-segments.geojson`; Harris references the LP032.2 partition manifest.
- Historical source inventory preserves 26 OSM county road extracts plus a Texas OSM PBF, and Census road archives for six additional counties. Application scripts preserve the LP030 upload/test pipeline and Harris partition/deployment pipeline.
- Local equivalents are partial (runtime/source road GeoJSON for Liberty, Montgomery, San Jacinto and several directional-intelligence source extracts). Current remote object existence and hashes were not freshly listed: `REMOTE_VERIFICATION_REQUIRED`.
- Road locality/place fields are `INCIDENTAL` or `ABSENT`; roadway names must not be interpreted as communities.
- Classification: existing valid road packages are `DERIVED_REUSABLE` and **must be preserved**. They can be reused directly for the current 28; no roadway repeat is required for LP188 community-source work. Roadway coverage for the other 226 counties is not established and is a separate future activation prerequisite, not a reason to rebuild existing packages.

## 10. Crossings

Trace:

`FRA raw Texas crossing GeoJSON`
→ processed `fra-crossings-tx.geojson`
→ 28 candidate county packages
→ 28 production packages/certifications/manifests
→ repository Crossing-Packages/runtime consumers.

The current tree has 89 files / 99,911,921 bytes, 29 top-level package manifests (28 counties plus the Texas source package), and 3,771 production crossing features. Properties include stable FRA crossing identifiers, `CITYNAME`, `CITYCD`, `COUNTYNAME`, coordinates, street/rail fields, and Gridly production metadata. No `resolvedLocality` field was found in production features. City fields are source-provided crossing context, not complete place authority.

Classification: `DERIVED_REUSABLE` for crossings and `VALIDATION_ONLY` for community names/aliases/county-place cross-checks. Do not rebuild.

## 11. Other source-family relevance

- NAD R23: official address dataset, national/Texas counts and 28-county GeoPackage derivatives historically present. Address locality/municipality/postal fields are validation and aliases only: `PARTIAL_VALIDATION_REUSE`.
- Texas Address Points: authoritative statewide address points, 2026 vintage, 12,142,647 records in the LP104 manifest, county FIPS and coordinates. Preserve; `ADDRESS_ONLY_REUSE` for Census-place purposes.
- FRA: authoritative crossing identity and coordinates with city/county context; `VALIDATION_SOURCE` only for communities.
- OpenStreetMap: Texas PBF, road extracts, rail; stable OSM IDs/labels may validate aliases and unincorporated labels, but are not Census place authority.
- DriveTexas and NOAA: placeholders only, `NOT_RELEVANT`.
- Texas Public Safety: a TCJS population report workbook, `NOT_RELEVANT`.

## 12. Supabase Storage inventory and recovery evidence

| Bucket / prefix | Family | Expected objects | Remote verified | Local copy | Manifest | Size/hash evidence | Recovery / LP188 value |
|---|---|---:|---|---|---|---|---|
| `certified-addresses/lp104/txgio-addresses/` | certified address package + runtime certificate | 508 (254 + 254) | historical yes (LP147); current no | 59 packages plus certificates/evidence | yes | expected and actual bytes/SHA-256 for every object | byte-identical recovery; address validation reuse |
| `certified-addresses/lp108/` | Harris lookup sidecar manifest + 256 buckets | 257 expected by code | not freshly verified | tooling/manifests partial | yes in code/generated evidence | per-bucket bytes/SHA-256 in sidecar manifest | preserve; address runtime optimization |
| `gridly-roadways/roadways/*` | public roadway packages | 27 LP030 objects + Harris partition manifest/parts | URLs historically configured; current no | partial | runtime manifest yes | incomplete in current runtime manifest | direct road reuse after read-only verification |
| `gridly-geocode` | no Storage bucket evidence | 0 | n/a | n/a | n/a | n/a | this is an Edge Function name, not a proven bucket |

No Supabase credential names were present in the process environment, so a safe fresh Storage listing was unavailable. Historical verification is retained rather than falsely represented as current. Source uploads were processed/certified artifacts and identity/hash metadata—not the raw TxGIO source.

## 13. Manufacturing pipeline reuse

| Pipeline | Inputs → transforms → outputs | Scope/determinism | Hash/manifest | Rerun? |
|---|---|---|---|---|
| LP104/LP130 address | TxGIO statewide points → normalize, validate, dedupe, county partition, gzip → 254 packages | statewide, deterministic contract; historically expensive | package manifest, batch hashes, certifications | **NO; recover exact artifacts** |
| LP107/LP108/LP147 address publication | packages → certificates → verify/sync Storage → runtime read | 254 counties; identity/hash gated | certificates and LP147 actual/expected hashes | no manufacturing rerun; fresh read-only existence check only |
| LP115 crossing | FRA processed Texas source → county filter/package | 28 current counties | production certificates/manifests/historical hashes | **NO** |
| LP116/LP118 roadway | OSM/TIGER geometry → county roadway candidates/extracts | county scoped; existing 28 evidence | runtime/source manifests are incomplete for all hashes | **NO for existing assets** |
| LP160.1 Overture | governed GeoParquet → schema selection/normalization → destination candidates | potentially statewide/deterministic, but source unavailable | source-unavailable and adapter reports | not runnable and not needed for Census authority decision |
| LP188 Census place | official place source → class/identity/county membership → packages | tooling/gate prepared, source absent | future hash/manifest contract only | cannot rerun; no previous place build exists |

Expected runtimes are not reliably recorded. The address manifest's 12.1 million input rows and owner warning establish that repeating it is expensive; absence of a timing value is not justification to rerun.

## 14. Authority ownership by stage

- Raw source authority/archive: the full Windows `Gridly-Source-Data` workspace, currently represented only by historical LP127B inventory plus 28 mounted Census county files.
- Manufactured address artifacts and runtime/governance evidence: `liberty-county-map/data/generated`, `reports/lp130-statewide-addresses`, LP147 and Supabase `certified-addresses`.
- Community/crossing/road manufactured packages: root package directories and source-workspace historical copies; runtime registry in `assets/package-registry`.
- Runtime artifact/consumer: application repository manifests, JavaScript, and Supabase Edge Function code.
- Governance evidence: application `evidence/` and `reports/`.

The separation is intentional and useful; no single repository needs to own all stages.

## 15. Authoritative source trace and classification

| Family | Trace | Source state |
|---|---|---|
| Census places | no runtime/package/tool output ← no place source | `SOURCE_ABSENT` |
| Census counties | county runtime/evidence ← 28 GeoJSON + historical national county shapefile ← Census TIGER/Line 2025 | `AUTHORITATIVE_SOURCE_PARTIAL` statewide in current mount; historical national source evidence |
| Addresses | gridly-geocode ← LP107 certificates/LP104 packages ← LP104/LP130 ← TxGIO 2026 | `AUTHORITATIVE_SOURCE_PRESENT_REMOTE_ONLY` for 11 payloads; source provenance complete, raw source historically local |
| Roadways | runtime manifest ← LP030/LP032 packages ← deployment/extraction tools ← OSM/TIGER | `SOURCE_PROVENANCE_INCOMPLETE` for full statewide scope; existing 28 derived assets reusable |
| Crossings | runtime/production packages ← certifications ← LP115/FRA processing ← FRA | `AUTHORITATIVE_SOURCE_PRESENT_LOCAL` as repository package copy/historical source inventory for current 28, not statewide community authority |
| Overture places | no runtime source ← adapters only ← unavailable GeoParquet | `SOURCE_ABSENT` |

## 16. Smallest correct remaining requirement

Acquire only what is missing: an official Census TIGER/Line Texas places dataset for a declared vintage, with source URL, retrieval metadata, bytes and SHA-256. Required fields are `STATEFP`, `PLACEFP`, `GEOID`, `NAME`, `NAMELSAD`/`LSAD`, class evidence (`CLASSFP`/`MTFCC` or documented equivalent), and geometry.

Relationship choice:

- **A — Census relationship file:** direct authoritative tabulation, simpler audit semantics, another artifact/vintage to acquire and reconcile.
- **B — geometry-derived membership:** deterministic intersection of official place geometry with official same-vintage Texas county geometry; retain every non-zero-area intersection, calculated area/ratio and boundary diagnostics so multi-county municipalities receive every valid county membership.

Use B if the same-vintage statewide county geometry is preserved with the place source; otherwise acquire the relationship file (or matching county geometry). Centroid-only containment is prohibited because it loses multi-county membership. This is the smallest correctness-preserving requirement and does not authorize manufacturing, deployment, activation, or restriction clearance.
