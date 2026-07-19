# LP029 — DriveTexas Provider Completeness Certification

Project: Gridly — Know Before You Go  
Branch status: **DO NOT MERGE**  
Merge recommendation: **DO NOT MERGE**

## Classification

**J. Unable to certify due to missing provider contract/network access.**

LP029 did not prove that the DriveTexas provider feed is incomplete. It also did not prove that the current `conditions.geojson` response is complete for all official construction, lane-closure, road-closure, bridge-restriction, advisory, future-work, planned-project, and incident classes. The repository establishes the current request contract and the passive runtime retention boundary, but the Codex environment could not complete a direct live capture because the outbound HTTPS tunnel was rejected before the DriveTexas server response could be inspected.

## Exact endpoint contract

Gridly's current DriveTexas live connector builds one request:

| Contract item | Current value |
| --- | --- |
| Base URL | `https://api.drivetexas.org` |
| Endpoint path | `/api/conditions.geojson` |
| Method | `GET` |
| Query parameters | `key={api_key}` only |
| API key handling | The key is read from `GRIDLY_CONFIG.driveTexas.apiKey`, then `GRIDLY_CONFIG.txdot.apiKey`, then `GRIDLY_TXDOT_API_KEY`, URL-encoded, and substituted into `{api_key}`. |
| Explicit request headers | None. |
| Cache policy | `cache: "no-store"`. |
| Timeout | `8000` ms when `AbortController` exists. |
| Retry behavior | Maximum `2` attempts; retry only for transient timeout/network, `408`, `429`, or `5xx` failures. |
| Pagination parameters | None configured. |
| Bounding/geography parameters | None configured. |
| District parameters | None configured. |
| Category/status/date parameters | None configured. |
| Maximum-result parameters | None configured. |

The endpoint-audit reference in the repository describes this as a DriveTexas road-conditions GeoJSON feed and not as a complete construction-program feed. Existing repository evidence does not include a current official Swagger/OpenAPI schema or official response contract for pagination, total counts, hidden server-side caps, or category-family inclusions.

## Raw response structure and counts

The connector requires the raw payload to be a GeoJSON `FeatureCollection` with a `features` array before it normalizes records. The current normalizer can also extract arrays named `incidents` or `records`, but the live connector rejects non-GeoJSON payloads before calling the normalizer.

LP029 could not certify a live raw count in this environment. The previously observed browser count of `629` is therefore treated as a retained normalized complete-source count unless a live raw capture proves otherwise. The passive LP029 helper reports raw response fields as `null` when raw response retention is unavailable rather than inferring or fabricating raw metrics from normalized records.

## Normalization and retention findings

Static connector/provider inspection establishes:

1. The live connector validates only `FeatureCollection.features` before normalization.
2. The provider normalizer maps every feature to one normalized record unless the feature object is invalid/null.
3. Normalization does not intentionally drop unknown categories; unknown category text falls through to `Travel Advisory`.
4. Normalization does not intentionally drop missing route names; `routeName` becomes an empty string.
5. Normalization does not intentionally drop missing coordinates; latitude/longitude can be `null`.
6. Normalization does not perform duplicate-ID collapsing.
7. Normalization does not collapse multiple conditions at the same coordinates.
8. Normalization does not evaluate start/end timestamps for active, expired, or future-only eligibility.
9. The connector stores normalized complete source records separately from the selected-awareness presentation view.

Because raw response retention is not currently available, LP029 cannot list exact live raw rows rejected during normalization. With the inspected code path, likely normalizer drops are limited to null/non-object features or JSON-clone failures, not category, route, duplicate, timestamp, or coordinate filtering.

## Pagination and response-limit evidence

Static request construction shows no `page`, `pageNumber`, `pageSize`, `total`, `limit`, `offset`, `next`, `nextToken`, `continuationToken`, `hasMore`, `links`, bounding, district, category, status, date, or maximum-result query parameter is sent by Gridly.

LP029 could not inspect live response headers/body metadata in Codex because the network tunnel returned `403 Forbidden` before a DriveTexas HTTP response was obtained. Therefore:

- No live provider `totalCount` larger than the returned collection length was observed.
- No live pagination headers were observed.
- No live truncation headers were observed.
- No live rate-limit headers were observed.
- No live content-length/body-size measurement was certified.
- No page-size or pagination-token experiment was certified.

## Conroe proximity findings

The prior browser evidence found no retained normalized record within the configured Conroe radius plus buffer and a nearest retained normalized record at `25.33` miles. LP029 adds a passive helper that can compute Conroe retained-source proximity counts at `10`, `15`, `25`, `35`, and `50` miles from `30.3119, -95.4558`, plus route-pattern counts near Conroe for:

- `IH0045 / I-45`
- `SH0105 / SH 105`
- `SL0336 / Loop 336`
- `FM1488`
- `FM2854`

Without a live raw response capture, LP029 cannot prove whether missing Conroe route records are absent from the provider source or present in raw payload and lost before runtime retention. Static code inspection finds no normalization rule that would specifically discard those routes.

## Dayton findings

The prior browser evidence found no retained normalized record within the configured Dayton radius plus buffer and a nearest retained normalized record at `12.21` miles. The passive helper can compute retained-source proximity counts at `10`, `15`, `25`, `35`, and `50` miles from Dayton coordinates used by the audit helper.

## Livingston findings

The prior browser evidence found `5` retained normalized records within the configured Livingston radius plus buffer and an exact match to Gridly's awareness count. The passive helper can compute retained-source proximity counts at `10`, `15`, `25`, `35`, and `50` miles from Livingston coordinates used by the audit helper.

## Are missing records absent from source or lost inside Gridly?

**Not certified.** Existing static evidence points away from Gridly category, route, duplicate, coordinate, or timestamp filtering as the cause, but raw response capture is required to distinguish these possibilities:

- Source endpoint does not include the missing records.
- Source endpoint intentionally returns only current travel-impacting conditions.
- A different DriveTexas endpoint/feed contains planned construction or additional advisories.
- Server-side filtering/capping/pagination exists but is undocumented in repository evidence.
- The response contains top-level collections/metadata ignored by the current live connector.

## Existing documents and tests

Repository searches found existing DriveTexas endpoint validation and provider-certification materials, including references to `conditions.geojson`, endpoint readiness, official provider source evaluation, and historical notes about manual live validation. Those materials certify endpoint readiness/dormancy and source suitability at earlier milestones; they do not certify LP029 completeness for the suspicious Conroe absence.

The helper names `futureTxdotIncidents` and `futureTxdotConstruction` are potentially misleading for LP029 completeness analysis because they are presentation/legacy helper names in `app.js`, while the LP028.8 retained complete-source evidence comes from `gridlyDriveTexasConnector.getAllNormalizedRecords()` and the connector area-lifecycle audit. LP029 should use retained connector source records, not presentation helper names, for completeness checks.

## Passive browser audit helper

LP029 adds:

```js
window.gridlyLp029DriveTexasProviderCompletenessAudit?.()
```

The helper is passive. It does not fetch, refresh, render UI, mutate connector state, change awareness area, resolve roads, or expose the API key. It reports only already-retained normalized evidence plus request-contract metadata with the secret removed. Raw response count, raw metadata, response headers, provider total count, and pagination metadata remain `null` unless a future milestone intentionally retains sanitized raw-capture metadata.

## Browser validation steps

1. Configure the DriveTexas API key in the normal local/runtime configuration. Do not paste the key into console logs, screenshots, issue text, or pull-request text.
2. Load the application and allow the existing DriveTexas connector fetch path to populate retained source records.
3. Run the console command below.
4. Confirm `fetchPerformed === false`, `passive === true`, and no API key string appears anywhere in the returned object.
5. Compare `normalizedCompleteCount`, `recordsWithValidCoordinates`, `conroeProximityCounts`, `daytonProximityCounts`, `livingstonProximityCounts`, and `conroeRouteCountsWithin50Miles` against DevTools Network response inspection.
6. In DevTools Network, inspect the single `conditions.geojson` response headers and body for top-level metadata, `features.length`, total-count fields, pagination tokens/links, transfer truncation, status, content type, content length, cache headers, and rate-limit headers.

## Console validation command

```js
window.gridlyLp029DriveTexasProviderCompletenessAudit?.()
```

## Root cause

**Root cause classification: J. Unable to certify due to missing provider contract/network access.**

Current evidence is enough to say Gridly calls one GeoJSON road-conditions endpoint with no scope-expanding query parameters, and that Gridly's inspected normalization path does not appear to discard Conroe/I-45/SH 105/Loop 336/FM 1488/FM 2854 records by category, route, duplicate, timestamp, or coordinate rules. It is not enough to say the DriveTexas response is complete or incomplete.

## Production repair needed?

No production endpoint, pagination, normalization, category, presentation, UI, service-worker, PWA, roadway asset, Supabase, marker, crossing, alert, Travel Brief, LP016, or LP023 repair is authorized by LP029. If live browser/approved-network capture proves another endpoint, pagination contract, or inclusion parameter is required, implement that as a separate focused milestone.

## Recommended next milestone

Run an approved live-provider contract capture outside the blocked Codex network path. The next milestone should collect sanitized response headers and small aggregated metrics only, verify official DriveTexas documentation or endpoint metadata, test possible documented page-size/pagination/inclusion parameters if available, and compare raw `features.length` to normalized retained counts without committing raw provider payloads or secrets.

## Merge recommendation

**DO NOT MERGE.** LP029 is investigation-first and classifies provider completeness as uncertified until live provider contract evidence is available.
