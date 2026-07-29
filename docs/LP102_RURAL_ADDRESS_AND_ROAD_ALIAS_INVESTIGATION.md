# LP102 Rural Address Coverage and House-number Safety Repair

## Production defect and root cause

Production subsequently supplied the missing decisive evidence: for `274 County Road 677, Dayton, TX 77535`, the primary provider returned `confirmed_no_result`, then the governed Census fallback returned TIGER line identity `635407484` as **`698 CO RD 677`**. Gridly correctly recorded `house_number_mismatch`, but the edge adapter filtered only for coordinates and the presence of *a* house number and road. It never required the returned canonical house number to equal the requested house number. The browser relevance gate could then retain the result on road agreement, allowing it into `finalRenderInput`, the visible DOM, and Route Preview. That was misleading: an address-range interpolation for 698 is not a result for house 274.

The repair adds a server-side fallback acceptance gate before a candidate can become a canonical result. For explicit numbered-address intent, both canonical house numbers are normalized (leading numeric zeroes are harmless; suffix letters remain significant) and must agree. A mismatch is hard-blocked with `rejectionRule: "house_number_mismatch"`, `rejectionStage: "fallback_acceptance_gate"`, `rejectionPhase: "pre_relevance"`, and disposition `rejected_house_number_mismatch`. A missing returned number, real roadway or geography conflict, invalid coordinates, road-only promotion, and unsupported precision claim are likewise hard blocks. Rejected candidates remain diagnostic evidence only and never enter `results`, relevance, rendering, or Route Preview.

The road comparison separately normalizes `County Road 677`, `County Rd 677`, `CR 677`, `Co Rd 677`, and `CO RD 677` to `cr 677`. Thus the production candidate is rejected for the actual house-number conflict, not for a false abbreviation conflict. No Web/Webb historical alias was introduced.

### Before and after

| Stage | Before repair | After repair |
|---|---|---|
| Primary | `confirmed_no_result` | `confirmed_no_result` |
| Census candidate | `698 CO RD 677`, accepted despite requested 274 | same upstream candidate faithfully mapped, rejected before relevance |
| Canonical outcome | `relevant_result` | `confirmed_no_result` when no other accepted candidate exists |
| Visible UI | misleading 698 result and Route Preview | truthful exact-address no-result; no candidate or Route Preview |

The adapter continues to map the upstream `fromAddress`, Census street components, city, state, ZIP, `coordinates.x/y`, `matchedAddress`, and TIGER line identity. It does not copy the query's house number into provider output. Census does not provide a dependable county field in this response shape or an address point/rooftop; absent values remain absent rather than invented. Address-range matches remain `interpolated_address`, never rooftop, parcel, driveway, resident, 911, or exact precision.

## Corrected authoritative conclusion

The newer production capture supersedes the earlier no-candidate observation. It proves the fallback was enabled and returned a mismatched numbered candidate that reached rendering. The safety gate in this repair addresses that demonstrated acceptance defect while retaining LP097 conflict handling, governed precedence, the Census fallback, and provider-boundary controls.

## Provider audit

`gridly-geocode` currently adapts Nominatim's JSONv2 search API. It sends either structured address fields or `q`, plus `format=jsonv2`, address details, US scope, limit, and an optional viewbox. The adapter produces Gridly-owned canonical results. The browser sends only POST requests to Gridly's Supabase function.

The function enforces an origin allow-list, a small JSON schema/body limit, server-only upstream access, an eight-second primary timeout, and a database-backed globally serialized one-second provider reservation. It honors primary HTTP 429 `Retry-After`, establishes a database cooldown, deduplicates identical in-flight requests, and caches successful address results for six hours, business results for 24 hours, and no-results for 60 seconds. Cache keys are SHA-256 hashes of normalized request data; raw queries are not used as keys. Supabase service credentials stay server-side. There was no configured inactive secondary adapter before LP102.

## Sources evaluated

| Model/source | Coverage and precision | License/use | Operations/privacy | Decision |
|---|---|---|---|---|
| Primary Nominatim/OpenStreetMap | Broad road/place coverage; confirmed gap for the retained rural case; precision varies with OSM data | ODbL attribution and public-service usage policy apply | Existing one-request-per-second governance and cache | Retain as primary |
| US Census Geocoding Services | Nationwide US address matching based on current Census/TIGER address ranges; useful for rural numbered roads, but coordinates may be interpolated rather than parcel/address points | US federal-government service/data; no browser key; operations must still follow Census availability guidance | Server-side request, bounded timeout, no secret, low integration burden | **Selected controlled secondary** |
| Licensed commercial address-point provider | Potentially stronger rooftop/address-point coverage | Contract, production-use terms, cost, key, and retention terms vary | Requires procurement and provider-specific operational review | Not enabled without an approved contract/configuration |
| County 911/address-point dataset | Potentially authoritative local points | No licensed, versioned, repository-approved Liberty County source or update agreement was found in the repository | Hosting, update cadence, access controls, and deletion policy would be Gridly's burden | Not enabled |
| Parcel/appraisal, real-estate, consumer search, or scraped data | Unsuitable evidence and/or unclear precision | Disallowed or insufficient production-use permission | Privacy and maintenance risk | Rejected |

The Census fallback was chosen because it is a narrow, server-side, nationwide US government source that requires no consumer-visible credential and returns structured matches and routeable coordinates. It is not chosen merely for one property. It does **not** provide authoritative rooftop points; Gridly therefore labels its matches `interpolated_address`, never `exact_address`.

Useful operational references are the Census Geocoding Services documentation (`https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html`), Census API terms (`https://www.census.gov/data/developers/about/terms-of-service.html`), Nominatim usage policy (`https://operations.osmfoundation.org/policies/nominatim/`), and OpenStreetMap copyright (`https://www.openstreetmap.org/copyright`). These links document the selected services; legal/procurement owners must approve production use and monitor changes.

## Selected architecture and policy

Model A is implemented:

```text
explicit browser Search -> Gridly edge -> primary adapter
  -> relevant primary result (preferred; fallback skipped)
  -> confirmed primary no-result + eligible rural address -> Census adapter
     -> canonical relevant non-exact address
     -> truthful canonical no-result
```

Fallback eligibility is enforced at the edge and requires all of: `requestMode: "explicit_search"`, address intent, a leading house number, recognized road identity (county road, FM/farm-to-market, state/US highway, or a named road/highway), and locality/state/ZIP context. It is disabled by default and enabled only by server configuration. Business/category queries, casual typing, road-only queries, governed destinations, and Saved Places cannot invoke it. Existing client precedence resolves local Saved Places/governed destinations before the remote candidate is rendered.

Primary success always wins. A primary canonical no-result is retained when the fallback has no match, times out, is rate-limited, or is temporarily unavailable; the fallback cannot incorrectly convert that truthful outcome into a primary failure. Provider-neutral resolution diagnostics separately record primary outcome, eligibility, invocation, fallback outcome, and source classification.

## Canonical mapping and precision

Both adapters return canonical identity, name/display/formatted address, coordinates, address components, result type, precision, confidence basis, provider-independent source classification, and Route Preview eligibility. Census components map `fromAddress` to house number, normalized street components to roadway, city to locality/mailing city, state/ZIP directly, and `coordinates.x/y` to longitude/latitude. The upstream adapter name is not displayed in consumer UI and no key is returned.

Precision rules:

* Primary address points may be `address_point` when the upstream record supports a house number.
* Census/TIGER matches are always `interpolated_address` with `authoritative_address_range_match` confidence and appear as relevant non-exact addresses.
* Road geometry remains `road`; it is never promoted to a numbered home.
* Missing supported matches remain truthful `no_results`.
* LP097 still blocks real house, road, city, county, state, ZIP, enriched-locality, and distance conflicts.

## Rate limits, timeout, cache, and privacy

The primary remains globally serialized. The fallback runs only following an eligible primary no-result and uses a configurable timeout bounded to 1–10 seconds (default six). It recognizes HTTP 429 and records a distinct fallback outcome. Diagnostics run sequentially with `delayMs` (default 1100 ms), no parallel matrix requests, no infinite retry, and no persisted manual values. Existing cache/in-flight coalescing covers the final canonical response; enabling the fallback changes the cache-key version dimension so old no-result entries do not mask it.

Only the normal Gridly request transmits a manual address. Manual case values remain in browser memory for that invocation, are not added to fixtures/local storage, and are not emitted in privacy-safe transport evidence. Do not paste private case output into tickets or screenshots.

## Governed coverage matrix

Committed cases include the owner-approved target and its County Road abbreviations, two known-invalid controls, two out-of-area controls, an urban address, Dayton Walmart, and Liberty Courthouse. Private valid rural homes are intentionally represented by session-only slots rather than committed values.

| Group | Required cases | Committed/session policy | Expected outcome |
|---|---:|---|---|
| Owner-approved County Road target | 1 + 3 abbreviation variants | Committed | supported non-exact candidate if Census contains a match; otherwise truthful no-result |
| Numbered county roads | 3 additional | session-only approved/public institutional inputs | supported non-exact or truthful no-result |
| FM/state-road addresses | 3 | session-only approved/public institutional inputs | supported non-exact or truthful no-result |
| Older named rural roads | 2 | session-only approved/public institutional inputs | supported non-exact or truthful no-result |
| Other known-valid rural Liberty County | 2+ (10 additional valid total) | session-only approved/public institutional inputs | supported non-exact or truthful no-result |
| Known invalid rural | 2 | synthetic committed/manual | truthful no-result |
| Out of area rural | 2 | public or synthetic committed/manual | relevant only to explicit out-of-area geography, never Liberty seed fallback |
| Urban/business/governed | 1 each | committed public controls | unchanged primary/business/governed behavior |

The repository does not claim production coverage percentages without executing those owner-approved session inputs against the deployed source. Record counts by category and outcome locally; do not persist queries.

## Configuration and deployment

Environment-variable names (never values):

* Existing: `GRIDLY_GEOCODE_PROVIDER`, `GRIDLY_GEOCODE_PROVIDER_URL`, `GRIDLY_GEOCODE_CACHE_NAMESPACE`, `GRIDLY_GEOCODE_USER_AGENT`, `GRIDLY_GEOCODE_ALLOWED_ORIGINS`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
* LP102: `GRIDLY_RURAL_FALLBACK_ENABLED`, `GRIDLY_RURAL_FALLBACK_URL`, `GRIDLY_RURAL_FALLBACK_BENCHMARK`, `GRIDLY_RURAL_FALLBACK_VINTAGE`, `GRIDLY_RURAL_FALLBACK_TIMEOUT_MS`.

Deploy the unchanged edge source with JWT verification disabled as already governed by `supabase/config.toml`; set the fallback enable flag only after operational/legal approval. Preserve the approved origins and existing database migration/RPCs. No browser configuration or upstream credential is required.

## Browser evidence and manual procedure

Targeted investigation:

```js
await window.gridlyLp102RuralAddressInvestigation?.({
  caseNames: ["county_road_full", "business_control", "governed_control"],
  delayMs: 1100
})
```

Private session-only cases:

```js
await window.gridlyLp102RuralAddressInvestigation?.({
  manualCases: [{
    caseName: "private_rural_address_test",
    query: "<entered locally in browser>",
    expectedIntent: "address"
  }],
  delayMs: 1100
})
```

Final certification:

```js
await window.gridlyLp102VisibleRuralAddressCertification?.()
```

For each retained candidate, inspect the resolution events, displayed address and precision, click the visible card, and confirm Route Preview uses that card's identity and coordinates. Network must show only `gridly-geocode`, never either upstream. Confirm invalid cases render no result and business/governed controls retain their normal precedence.

## Remaining limitations and merge recommendation

Census matching is address-range based and is not proof of a parcel entrance, rooftop, resident, or 911 point. Rural roads absent from current Census/TIGER data still return no result. County is not supplied by the Census address component used here, so LP097 must rely on the other canonical geography rather than inventing it. Census availability has no Gridly SLA; primary no-result truth is preserved during fallback failures. A licensed county 911/address-point or commercial rooftop source remains the future route to true exact-address precision after governance approval.

Automated contracts validate orchestration and invariants but are not production browser evidence. **Do not recommend merge** until the updated edge function is deployed with approved configuration and the production certification returns `failedChecks: []` and `safeToMerge: true`, followed by the private 10-address coverage run. This repository change deliberately does not claim that those production checks have happened.

## Visible certification runtime repair

Production execution of `await window.gridlyLp102VisibleRuralAddressCertification?.()` exposed the deterministic exception `ReferenceError: houseNumberSafetyPass is not defined`. The certification helper attempted to assemble its `checks`, `failedChecks`, return value, and `safeToMerge` result using `houseNumberSafetyPass`, `mismatchedCandidateRejected`, `truthfulNoResultObserved`, and `roadwayNormalizationPass`, but those names existed only in the separate investigation helper's function scope. They were therefore not declared in the certification helper's scope.

The repair initializes every certification field before orchestration begins, evaluates each field explicitly after both investigation runs complete, and assembles `failedChecks` and `safeToMerge` only from those initialized values. Missing or incomplete evidence remains a truthful `false`, rather than becoming `undefined` or an exception. Narrow orchestration error handling now returns a sanitized `internalCertificationError` result while retaining the full exception only in the developer console. HTTP 429 evidence explicitly fails `rateLimitBehaviorPass` and keeps `safeToMerge` false; it is not treated by the certification as a confirmed no-result.

This repair is limited to the visible browser certification helper and its contracts. It does not change destination search, rural candidate acceptance, Census fallback behavior, provider selection, ranking, rendering, Route Preview, business/governed precedence, or the Edge Function. Consequently, no Edge Function redeployment is required for this runtime repair. The updated browser JavaScript must be deployed and cache-busted (or loaded with a hard refresh) before repeating:

```js
await window.gridlyLp102VisibleRuralAddressCertification?.()
```

If production remains rate-limited, the expected structured failure includes `internalCertificationError: false`, `rateLimitBehaviorPass: false`, `failedChecks` containing `"rateLimitBehaviorPass"`, and `safeToMerge: false`; other checks without complete evidence may also be listed. The previously observed HTTP 429 remains an unresolved production certification condition, not a repaired or suppressed condition. **Merge is not yet recommended based on automated contracts alone**: repeat the cache-busted production browser certification and require complete evidence, no unresolved rate limit, `failedChecks: []`, and `safeToMerge: true` before making the production merge decision.
