# LP040 — DriveTexas Provider Completeness Certification

## Executive Summary

LP040 is an investigation-only provider certification. It does not repair, optimize, widen authority, alter connector logic, change UI, or modify production behavior.

Gridly cannot currently certify that it receives every official DriveTexas roadway event before authority filtering. The repository shows one DriveTexas request path, one configured GeoJSON endpoint, no Gridly-side request filters beyond the API key, no implemented pagination, and no repository-retained provider total, downloaded count, parsed count, response headers, pagination metadata, or raw provider field inventory. The retained complete source array is therefore complete only relative to the single downloaded `conditions.geojson` response, not certified complete relative to every official DriveTexas record that may be available.

Overall Provider Completeness: **FAIL — unable to certify complete official provider set**.

## Pipeline Diagram

```text
DriveTexas conditions.geojson endpoint
  ↓ GET, cache no-store, API key only
js/gridlyDriveTexasLiveConnector.js requestPayload()
  ↓ HTTP success and JSON body
validateGeoJson()
  ↓ FeatureCollection/features schema gate
normalizePayload()
  ↓ provider.normalizeRecords(payload)
js/gridlyDriveTexasProvider.js extractRawRecords()
  ↓ GeoJSON feature properties + __geometry
normalizeRecord()
  ↓ reduced normalized model
allNormalizedRecords retained complete-source cache
  ↓ filterAwarenessRecords()
awarenessNormalizedRecords authority input
  ↓ downstream consumers
Travel Brief / official consumers / UI
```

## Provider Requests

| Item | Finding |
| --- | --- |
| URL | `https://api.drivetexas.org/api/conditions.geojson?key={api_key}` by default. |
| API type | GeoJSON over HTTPS JSON. |
| GeoJSON | Yes; connector requires `FeatureCollection` with `features` array. |
| JSON | Yes; response is parsed with `response.json()`. |
| ArcGIS Feature Service | No repository evidence that the active endpoint is queried as ArcGIS Feature Service. |
| REST query | No ArcGIS REST query parameters are used. |
| Pagination support | Not evidenced in repository. |
| Max record limits | Not evidenced in repository. |
| Transfer limits | Not evidenced in repository. |
| Geometry options | No geometry options configured; default provider GeoJSON geometry only. |
| Supported query parameters | Not evidenced in repository. |
| Default query parameters | Only `key`. |
| Cache behavior | `fetch` uses `cache: "no-store"`. |
| Timeout | 8,000 ms. |
| Retry behavior | Two attempts maximum; retries only transient 408, 429, 5xx, timeout, and network failures. |
| Refresh behavior | Optional connector polling every 180,000 ms when `startPolling()` is invoked. |

Request origin is `fetchNow()` / `fetchNowInternal()` in `js/gridlyDriveTexasLiveConnector.js`. The provider's older `refresh()` path can also request the configured endpoint when explicitly called, but the live connector is the current retained-source path used by downstream DriveTexas consumers.

## Pagination

No pagination implementation exists in the active connector.

| Question | Finding |
| --- | --- |
| Current page size | None configured. |
| Maximum records | Unknown; not retained from provider contract or response metadata. |
| Multiple pages requested | No. |
| Only first page loads | Unknown. If DriveTexas applies default pagination server-side to `conditions.geojson`, Gridly has no code to request later pages. |
| Records beyond first page ignored | Unable to certify from repository evidence. |

## Filtering Inventory

| Stage | Removes records? | Evidence / effect |
| --- | --- | --- |
| Provider endpoint | Unknown | Single endpoint may or may not include every official category; repository has no current official provider contract. |
| Connector request | No Gridly-side scoping filters | No county, bounding box, district, category, status, date, active/inactive, or max-record query parameters are configured. |
| Download | No array truncation found | Successful response body is returned as JSON. |
| Schema validation | All records on invalid schema | Connector fails closed unless payload is GeoJSON `FeatureCollection` with a `features` array. |
| Pre-normalization extraction | Invalid feature objects | GeoJSON features are mapped to properties plus `__geometry`; null/non-object features are dropped. |
| Normalization | Missing/non-object records | Normalized records are filtered truthy. |
| Deduplication | No | Duplicate IDs are not removed in retained source. |
| Expiration | No | No pre-authority timestamp expiration found. |
| Retention | No | `allNormalizedRecords` retains the normalized complete-source response until the next successful fetch. |
| Authority | Yes | Awareness view filters retained records by point-radius or text fallback. |
| Consumer | Downstream/out of scope | LP040 does not certify UI or consumer filtering. |

## Field Inventory

| Provider field family | Loaded / preserved status |
| --- | --- |
| Event ID | Preserved as `id` and `sourceTrace.sourceId` when known; otherwise synthetic fallback ID. |
| Category | Renamed/transformed by regex inference into one of seven normalized categories. |
| Road names | Preserved only as `routeName` from selected route/road/highway keys. |
| Description/title | Description preserved from selected text fields; title is derived as category plus route. |
| Timestamps | `startTime` and `endTime` preserved from selected start/end keys only. |
| Geometry | Point preserved as latitude/longitude; LineString reduced to midpoint; full geometry discarded. |
| Limits | Not loaded. |
| Start/end coordinates | Not loaded. |
| Roadway extent | Not loaded. |
| County | Ignored/discarded in normalized model. |
| City/locality | Ignored/discarded in normalized model. |
| District | Ignored/discarded in normalized model. |
| Project identifiers | Not specifically preserved unless one aliases to selected ID keys. |
| Construction identifiers | Not specifically preserved unless one aliases to selected ID keys. |
| Roadway identifiers | Not specifically preserved beyond route text. |
| Provider metadata | Mostly discarded; raw payload is not exposed and not retained in normalized records. |

## Category Inventory

Configured normalized categories are:

- Road Closure
- Flooding
- Construction
- Lane Closure
- Crash
- Bridge Restriction
- Travel Advisory

Categories do not receive endpoint-specific filtering in Gridly. They do receive normalization treatment: category labels are inferred from provider condition/type/category text plus description/title text. Anything unmatched collapses to `Travel Advisory`. This means category completeness cannot be certified without raw provider category counts.

## Construction Review

Construction is not filtered differently in the connector before authority. It uses the same request, same refresh path, same normalization pipeline, same retained source cache, same awareness filtering, and same no-expiration behavior as other categories.

Construction completeness is still **unable to certify** because the active endpoint contract is not proven to include every official long-duration construction or project record shown by DriveTexas.

## Geometry Review

Geometry preservation fails as a completeness-proof requirement. Gridly preserves point coordinates as normalized latitude/longitude. If a GeoJSON `LineString` exists, Gridly derives only the midpoint. Full line geometry, limits, start/end coordinates, and roadway extent are not retained in loaded normalized records.

## Record Count Trace

| Count | Current certifiable value |
| --- | --- |
| Provider reported count | Unknown / not retained. |
| Downloaded count | Unknown / raw response count not retained after normalization. |
| Parsed count | Unknown as persistent runtime evidence; extraction count exists only transiently. |
| Normalized count | Runtime `allNormalizedRecords.length`. |
| Loaded count | Runtime `allNormalizedRecords.length`. |
| Authority input count | Runtime `awarenessNormalizedRecords.length`. |
| Consumer eligible count | Unknown / downstream out of LP040 scope. |
| Consumer visible count | Unknown / downstream out of LP040 scope. |

The first unavoidable count divergence is between provider-reported/downloaded/parsed evidence and normalized retained evidence: Gridly does not retain the upstream counts required for certification.

## Hard Limits

| Limit / pattern | Finding |
| --- | --- |
| `TIMEOUT_MS` | 8,000 ms request abort limit. |
| `MAX_ATTEMPTS` | 2 attempts. |
| `REFRESH_INTERVAL_MS` | 180,000 ms between polling fetches when polling is active. |
| `cache` | `no-store`, not a truncation risk. |
| `slice()` | Used to clone arrays in provider extraction/runtime access; no fixed truncation found. |
| `take()` | Not found in DriveTexas connector/provider path. |
| `first()` | Not found in DriveTexas connector/provider path. |
| `maxRecords` | Not configured. |
| `pageSize` | Not configured. |
| `resultRecordCount` | Not configured. |
| 100/250/500/750/1000 caps | No repository-side DriveTexas cap found. |
| FeatureServer defaults | Not applicable to current configured endpoint from repository evidence. |
| Early return | Fetch-in-flight coalescing returns the existing promise; invalid schema/network failure fails closed. |
| Memory protection | No array-size memory cap found in DriveTexas provider/connector. |

## Completeness Certification

| Area | Score |
| --- | --- |
| Provider Reachability | Unknown from passive audit unless runtime last fetch succeeded. |
| Pagination | Unable to certify. |
| Provider Count Match | Unable to certify. |
| Normalization Count Match | Unable to certify raw-to-normalized because raw count is not retained. |
| Category Completeness | Unable to certify. |
| Construction Completeness | Unable to certify. |
| Geometry Preservation | Fail. |
| Provider Metadata Preservation | Fail. |
| Overall Provider Completeness | Fail — unable to certify complete official provider set. |

## Recommendations

1. Run a sanctioned live DriveTexas contract capture that records response headers, provider totals, raw feature count, and pagination metadata without storing raw payloads or secrets.
2. Add audit-only raw-to-normalized counters in a future milestone so provider/downloaded/parsed/normalized/loaded counts can be compared.
3. Verify official DriveTexas documentation or endpoint metadata for pagination, transfer limits, categories, construction/project coverage, geometry options, and server-side filters.
4. Compare sanitized runtime counts against the public DriveTexas website or an official export when authorized.

## Non-Recommendations

- Do not widen authority based on LP040.
- Do not modify UI or consumer visibility.
- Do not alter connector request logic in LP040.
- Do not fabricate missing provider records.
- Do not infer completeness from the absence of downstream records.

## Next Milestone

**LP041 — DriveTexas live contract capture and audit-only raw count instrumentation.**

The next milestone should collect sanctioned, sanitized provider-contract evidence and implement passive diagnostics that retain aggregate counts and metadata only, not raw official payloads or API keys.
