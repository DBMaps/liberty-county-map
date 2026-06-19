# GRIDLY Multi-County Asset Acquisition Capability Audit V600.5

## 1. Executive Summary

V600.5 is an audit-only milestone to determine whether the Codex execution environment can directly acquire county-owned runtime assets for the V600 scoped counties before V601 asset acquisition. No production assets were acquired, no runtime code was modified, no assets were registered, no counties were activated, no Supabase changes were made, DriveTexas was not resumed, Transportation Intelligence was not enabled, and historical reads/UI/API/dashboard behavior was not enabled.

Authoritative guidance used:

- V599A contract summary as preserved in `GRIDLY-MONTGOMERY-ASSET-ACQUISITION-PLAN-V599.md`.
- V600 multi-county runtime asset standard in `GRIDLY-MULTI-COUNTY-RUNTIME-ASSET-STANDARD-V600.md`.

Final determination: **MANUAL ACQUISITION REQUIRED**.

Reason: the preferred public sources are appropriate and contract-compatible after conversion, but this Codex execution environment could not directly download either Census TIGER/Line assets or FRA/Socrata crossing records during the audit. Every tested HTTPS request to the Census and data.transportation.gov endpoints failed at the CONNECT tunnel with `403 Forbidden`. In addition, `ogr2ogr` is not installed in the environment, so shapefile-to-GeoJSON conversion is not currently available without adding tooling. Overrides remain fully automatable because they are local JSON files initialized as `{}`.

## 2. Source Capability Matrix

| Asset class | Preferred source | Direct access from current environment | Download capability observed | Runtime conversion required | Tooling observed | Capability result |
|---|---|---:|---:|---:|---|---|
| County Boundaries | Census TIGER/Line 2025 county boundary ZIP | No | No; `CONNECT tunnel failed, response 403` | Yes; shapefile ZIP must be filtered and converted to GeoJSON FeatureCollection | `ogr2ogr` not found | **BLOCKED** in current environment |
| County Road Segments | Census TIGER/Line 2025 All Roads county ZIPs | No | No; `CONNECT tunnel failed, response 403` | Yes; shapefile ZIP must be converted and normalized | `ogr2ogr` not found | **BLOCKED** in current environment |
| County Rail Crossings | FRA / U.S. DOT Crossing Inventory Data Form 71 Current, Socrata dataset `m2f8-22s6` | No | No; `CONNECT tunnel failed, response 403` | Yes; filter/export records and normalize fields into Point GeoJSON | Node can transform if data is provided; remote acquisition blocked | **BLOCKED** in current environment |
| County Crossing Overrides | Local repo-created JSON | Yes | Not applicable | No external conversion; create exact `{}` | Shell/Node sufficient | **READY** |

## 3. Boundary Capability Findings

V600 recommends the U.S. Census Bureau TIGER/Line 2025 County boundary shapefile as the boundary source, downloaded from:

```text
https://www2.census.gov/geo/tiger/TIGER2025/COUNTY/tl_2025_us_county.zip
```

Required V600 handling is to filter the national county boundary dataset to Texas and the scoped county `GEOID`, then produce a county-owned GeoJSON FeatureCollection in WGS84 `[lng, lat]` coordinates.

Audit result:

- The environment attempted a HEAD request against the Census boundary ZIP.
- The request failed before asset transfer with `curl: (56) CONNECT tunnel failed, response 403` and an HTTP `403 Forbidden` response from the tunnel/proxy path.
- No boundary ZIP was downloaded.
- No production boundary asset was created.
- The source is public and suitable in principle, but direct acquisition from this environment is currently blocked.

Restrictions and conversion requirements:

- Census TIGER/Line boundary data is distributed as a shapefile ZIP, not as a runtime-ready GeoJSON asset.
- Conversion is required from shapefile to GeoJSON.
- Filtering is required so each county package contains exactly the scoped county geometry.
- `ogr2ogr` was not found in this environment, so the expected V599/V600 conversion command path is unavailable unless GDAL or an equivalent converter is installed.

Automation determination for boundaries: **Manual acquisition required in the current environment**. If network/proxy access to `www2.census.gov` is enabled and GDAL is installed, boundary acquisition can become fully automated.

## 4. Road Capability Findings

V600 recommends U.S. Census Bureau TIGER/Line 2025 All Roads by county, using this download pattern:

```text
https://www2.census.gov/geo/tiger/TIGER2025/ROADS/tl_2025_{GEOID}_roads.zip
```

Scoped county road ZIPs from V600:

| County | GEOID | Expected road ZIP |
|---|---:|---|
| Montgomery | 48339 | `tl_2025_48339_roads.zip` |
| Chambers | 48071 | `tl_2025_48071_roads.zip` |
| San Jacinto | 48407 | `tl_2025_48407_roads.zip` |
| Polk | 48373 | `tl_2025_48373_roads.zip` |
| Jefferson | 48245 | `tl_2025_48245_roads.zip` |
| Harris | 48201 | `tl_2025_48201_roads.zip` |

Audit result:

- The environment attempted a HEAD request against the Montgomery county road ZIP.
- The environment attempted a ranged download against the Chambers county road ZIP into `/tmp`, specifically to avoid acquiring a production asset.
- Both requests failed before asset transfer with `curl: (56) CONNECT tunnel failed, response 403`.
- The ranged download reported `http_code=000 size=0`.
- No county road ZIP was downloaded.
- No production road asset was created.

Restrictions and blockers:

- The source is a public federal dataset and remains the preferred source in principle.
- Current direct access is blocked by the execution environment network/proxy path.
- Roads are distributed as shapefile ZIPs, so conversion and field normalization are required.
- `ogr2ogr` is not installed, which blocks the recommended conversion workflow even if download access were fixed.
- The `file` command is also unavailable, limiting local binary inspection during audit evidence collection.

Automation determination for roads: **Manual acquisition required in the current environment**. With access to `www2.census.gov` and an installed shapefile conversion tool, V601 road acquisition can be fully scripted.

## 5. FRA Capability Findings

V600 recommends the FRA / U.S. DOT Crossing Inventory Data Form 71 Current dataset:

```text
https://data.transportation.gov/Railroads/Crossing-Inventory-Data-Form-71-Current/m2f8-22s6
```

Recommended GeoJSON/API query pattern from V599/V600:

```text
https://data.transportation.gov/resource/m2f8-22s6.geojson?$limit=5000&statename=TEXAS&countyname={COUNTY}
```

Audit result:

- The environment attempted a HEAD request against the Montgomery filtered GeoJSON endpoint.
- The environment attempted a small GET request against the Montgomery filtered GeoJSON endpoint.
- The environment attempted county count checks through the Socrata JSON API for Montgomery, Chambers, San Jacinto, Polk, Jefferson, and Harris.
- The visible HEAD and GET attempts failed with `curl: (56) CONNECT tunnel failed, response 403` and HTTP `403 Forbidden`.
- The county count commands returned no JSON output because the same remote access path was unavailable.
- No FRA records were downloaded.
- No production crossing asset was created.

Access limitation findings:

| Limitation type | Observed? | Evidence |
|---|---:|---|
| `403` | Yes | `CONNECT tunnel failed, response 403`; `HTTP/1.1 403 Forbidden` |
| Authentication challenge | No explicit application-level authentication challenge observed | Request failed at tunnel/proxy path before dataset response body |
| Rate limit | Not observed | No `429` or rate-limit headers reached |
| Download restriction | Yes in practice | Environment could not reach Socrata endpoint |
| API restriction | Yes in practice | Socrata API calls did not return JSON through this environment |

Automation determination for FRA crossings: **Manual acquisition required in the current environment**. The source is automatable in principle via Socrata GeoJSON/JSON queries, but this environment cannot directly reach the endpoint during V600.5.

## 6. Runtime Contract Compatibility Review

### 6.1 Road Contract

V599A/V600 road requirements:

- GeoJSON `FeatureCollection`.
- `LineString` or `MultiLineString` geometries.
- WGS84 `[lng, lat]` coordinates.
- Road identity fields.
- Road classification fields.

Compatibility review:

| Source | Raw compatibility | Required normalization | Result |
|---|---|---|---|
| Census TIGER/Line 2025 All Roads | Raw ZIP/shapefile is not runtime-ready GeoJSON, but source geometry is a road/path line layer. | Unzip, convert to GeoJSON, validate `LineString`/`MultiLineString`, preserve source fields such as `FULLNAME`, `RTTYP`, `MTFCC`, `LINEARID`, and derive runtime properties such as `roadName`, `roadRef`, `roadClass`, `sourceId`. | **Compatible after conversion** |

### 6.2 Crossing Contract

V599A/V600 crossing requirements:

- GeoJSON `FeatureCollection`.
- Point geometry.
- Stable crossing id.
- Road/name fields.
- Railroad fields.
- City/community fields.

Compatibility review:

| Source | Raw compatibility | Required normalization | Result |
|---|---|---|---|
| FRA / U.S. DOT Crossing Inventory Data Form 71 Current | Socrata can provide GeoJSON in principle, and the dataset is the correct crossing inventory family, but current environment access is blocked. | Filter `statename=TEXAS` and exact county name; map stable DOT crossing identifier to `crossingId`; validate coordinates; create Point `[lng, lat]`; preserve road/street, railroad, city/community, county, and status fields; quarantine rows missing stable id or valid coordinates. | **Compatible after export and normalization, but acquisition blocked here** |

### 6.3 Boundary Contract

V600 boundary requirements:

- GeoJSON `FeatureCollection`.
- Valid county geometry.
- WGS84 `[lng, lat]` coordinates.
- Exactly the scoped county.

Compatibility review:

| Source | Raw compatibility | Required normalization | Result |
|---|---|---|---|
| Census TIGER/Line 2025 County boundary | Raw national shapefile ZIP is not runtime-ready and includes many counties. | Unzip, filter to scoped Texas county `GEOID`, convert to GeoJSON FeatureCollection, validate county identity and geometry. | **Compatible after conversion, but acquisition blocked here** |

### 6.4 Override Contract

V599A/V600 override requirements:

- JSON object.
- Initialized as exactly `{}`.
- No placeholder keys, comments, array wrapper, metadata envelope, or Liberty-derived content.

Compatibility review:

| Source | Raw compatibility | Required normalization | Result |
|---|---|---|---|
| Local repo-created JSON object | Directly compatible. | Create exact `{}` in the future acquisition milestone only. | **READY** |

## 7. County Readiness Matrix

Readiness values reflect capability in the current Codex execution environment, not the public-source suitability in principle.

| County | Boundary acquisition readiness | Road acquisition readiness | Crossing acquisition readiness | Override readiness | Notes |
|---|---|---|---|---|---|
| Montgomery County, Texas | **READY WITH OBSERVATIONS** | **BLOCKED** | **BLOCKED** | **READY** | V600 notes an existing Montgomery boundary outside the canonical `runtime-assets/` path; direct Census/FRA acquisition blocked by `403`. |
| Chambers County, Texas | **BLOCKED** | **BLOCKED** | **BLOCKED** | **READY** | Census boundary/roads and FRA crossings require remote access currently blocked. |
| San Jacinto County, Texas | **BLOCKED** | **BLOCKED** | **BLOCKED** | **READY** | Census boundary/roads and FRA crossings require remote access currently blocked. |
| Polk County, Texas | **BLOCKED** | **BLOCKED** | **BLOCKED** | **READY** | Census boundary/roads and FRA crossings require remote access currently blocked. |
| Jefferson County, Texas | **BLOCKED** | **BLOCKED** | **BLOCKED** | **READY** | Census boundary/roads and FRA crossings require remote access currently blocked. |
| Harris County, Texas | **BLOCKED** | **BLOCKED** | **BLOCKED** | **READY** | Census boundary/roads and FRA crossings require remote access currently blocked. |

## 8. Automation vs Manual Acquisition Assessment

| Workflow step | Current environment result | Future automation path if blockers are removed |
|---|---|---|
| Download Census county boundary ZIP | Blocked by `403` | `curl -L` from Census endpoint, then filter by `GEOID` |
| Download Census county road ZIPs | Blocked by `403` | Loop through V600 county GEOIDs and download each `tl_2025_{GEOID}_roads.zip` |
| Convert Census shapefiles to GeoJSON | Blocked by missing `ogr2ogr` | Install/use GDAL `ogr2ogr` or equivalent JS/Python shapefile converter |
| Query FRA Socrata filtered crossings | Blocked by `403` | Socrata `.geojson` or `.json` API queries with URL-encoded county filters |
| Transform FRA records to runtime crossing GeoJSON | Possible if data is supplied locally | Node script can validate id/coordinates and produce FeatureCollection |
| Create override JSON files | Fully automatable | Create exact `{}` in package-scoped county path during V601 |
| Register assets / activate counties | Out of scope and prohibited | Should remain out of V601 acquisition unless separately authorized later |

Overall current assessment: **manual user download or environment remediation is required before V601 can acquire Census and FRA production assets from within Codex**.

## 9. Risks and Blockers

1. **Network/proxy `403` blocker**: Census and FRA endpoints failed at the CONNECT tunnel layer. This prevents direct production acquisition by Codex.
2. **Missing GDAL tooling**: `ogr2ogr` is not installed, blocking the documented V599/V600 shapefile conversion workflow.
3. **No binary inspection utility**: `file` is not installed, reducing audit confidence for any downloaded binary ZIP validation in this environment.
4. **FRA field-name validation deferred**: Because Socrata access failed, V601 must validate exact field names and coordinate/id availability from a successful export or from a user-provided file.
5. **County-name filter exactness**: FRA county filters must be verified for exact spelling/casing, especially `SAN JACINTO`, after API access is available.
6. **Montgomery boundary path observation**: Montgomery has an existing boundary file outside the V600 canonical `runtime-assets/` path. V601 should decide whether to normalize/copy it with provenance or grandfather it through manifest evidence.
7. **Avoid accidental production acquisition**: Future retry commands should write to temporary audit paths until V601 is explicitly authorized to create package assets.

## 10. Recommended V601 Scope

Recommended V601 scope: **acquisition only after manual source staging or environment remediation**.

V601 should proceed only if one of these prerequisites is satisfied:

1. The Codex environment is granted working network access to `www2.census.gov` and `data.transportation.gov`, and a shapefile-to-GeoJSON converter such as GDAL/`ogr2ogr` is installed; or
2. The user manually downloads and provides the required Census ZIPs and FRA exports to a non-production staging location for Codex to transform and validate.

Recommended V601 work items:

- Keep all assets package-scoped under `assets/county-implementation/{county-slug}/runtime-assets/`.
- Do not register assets.
- Do not activate counties.
- Do not reuse Liberty assets.
- Do not modify Supabase.
- Do not resume DriveTexas.
- Do not enable Transportation Intelligence.
- Do not enable historical reads/UI/API/dashboard.
- Create or normalize boundaries only from scoped county source files.
- Convert Census All Roads ZIPs into runtime road GeoJSON and validate geometry/property contracts.
- Convert FRA county crossing exports into runtime crossing GeoJSON and validate stable ids, coordinates, and descriptive fields.
- Create override JSON files initialized as exactly `{}`.
- Produce provenance/checksum notes and validation reports for each county.

## Testing / Evidence

All commands used for this audit are listed below. Failed requests and limitations are recorded inline.

```bash
pwd && rg --files -g 'AGENTS.md' -g '*V599*' -g '*V600*' -g '*.md' | head -200
```

Purpose: locate repository context, AGENTS instructions, and authoritative V599/V600 documents.

```bash
find .. -name AGENTS.md -print && rg --files | rg 'V599A|V600'
```

Purpose: confirm no scoped `AGENTS.md` instructions were present and locate V600 documents.

```bash
rg -n "V599A|599A|Runtime contract|asset" GRIDLY-MONTGOMERY-ASSET-ACQUISITION-PLAN-V599.md GRIDLY-MULTI-COUNTY-RUNTIME-ASSET-STANDARD-V600.md | head -120
```

Purpose: extract authoritative contract/source guidance.

```bash
sed -n '31,160p' GRIDLY-MULTI-COUNTY-RUNTIME-ASSET-STANDARD-V600.md && sed -n '31,155p' GRIDLY-MONTGOMERY-ASSET-ACQUISITION-PLAN-V599.md
```

Purpose: review V600 asset paths/sources and V599A contract summary.

```bash
curl -I -L https://www2.census.gov/geo/tiger/TIGER2025/COUNTY/tl_2025_us_county.zip
```

Result: failed. Evidence: `curl: (56) CONNECT tunnel failed, response 403`; `HTTP/1.1 403 Forbidden`.

```bash
curl -I -L https://www2.census.gov/geo/tiger/TIGER2025/ROADS/tl_2025_48339_roads.zip
```

Result: failed. Evidence: `curl: (56) CONNECT tunnel failed, response 403`; `HTTP/1.1 403 Forbidden`.

```bash
curl -L -r 0-1023 https://www2.census.gov/geo/tiger/TIGER2025/ROADS/tl_2025_48071_roads.zip -o /tmp/v6005_chambers_roads.head.zip -w 'http_code=%{http_code} size=%{size_download}\n'
```

Result: failed. Evidence: `curl: (56) CONNECT tunnel failed, response 403`; `http_code=000 size=0`. The target was `/tmp` and was a partial/ranged audit probe, not a production asset.

```bash
file /tmp/v6005_chambers_roads.head.zip || true
```

Result: failed due environment limitation. Evidence: `/bin/bash: line 10: file: command not found`.

```bash
curl -I -L 'https://data.transportation.gov/resource/m2f8-22s6.geojson?$limit=1&statename=TEXAS&countyname=MONTGOMERY'
```

Result: failed. Evidence: `curl: (56) CONNECT tunnel failed, response 403`; `HTTP/1.1 403 Forbidden`.

```bash
curl -L 'https://data.transportation.gov/resource/m2f8-22s6.geojson?$limit=3&statename=TEXAS&countyname=MONTGOMERY'
```

Result: failed. Evidence: `curl: (56) CONNECT tunnel failed, response 403`.

```bash
for c in 'MONTGOMERY' 'CHAMBERS' 'SAN JACINTO' 'POLK' 'JEFFERSON' 'HARRIS'; do echo "$ c=$c count"; curl -G -s --max-time 30 'https://data.transportation.gov/resource/m2f8-22s6.json' --data-urlencode '$select=count(*)' --data-urlencode 'statename=TEXAS' --data-urlencode "countyname=$c"; echo; done
```

Result: failed/no dataset JSON returned. Evidence: county labels printed, but no JSON response bodies were received through the environment.

```bash
which ogr2ogr && ogr2ogr --version || true
```

Result: failed due missing conversion tooling. Evidence: no `ogr2ogr` path/version was printed.

```bash
which tippecanoe || true
```

Result: not found. This is non-blocking for V599/V600 GeoJSON runtime assets but was checked as a possible geospatial utility.

## Final Determination

**MANUAL ACQUISITION REQUIRED**

The preferred public sources remain the right V601 sources, and their data models are compatible with the runtime contracts after conversion/normalization. However, the current Codex execution environment cannot directly acquire the Census or FRA source data due observed `403` CONNECT tunnel failures, and it lacks the primary shapefile conversion tool expected by V599/V600. V601 should either wait for environment remediation or use user-provided/manual source downloads staged outside production asset paths.
