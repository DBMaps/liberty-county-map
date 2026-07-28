# GRIDLY LP096 — Destination Address Search Capability Audit

**Milestone:** LP096

**Date:** 2026-07-28

**Scope:** Audit and passive runtime evidence only; no address-search repair
**Decision:** **High launch risk; a complete rural street address is not presently certified as a reliable consumer capability.**

## 1. Executive Summary

### Direct answer

**Can Gridly currently find a complete user-entered street address?** The production source contains a complete-address *attempt path*, but the consumer capability is **not reliable or certified**. Every trimmed query of three or more characters is sent from the browser directly to OpenStreetMap Nominatim. A Nominatim result with valid coordinates can survive normalization, render, be selected, and become the destination of an OSRM route preview. However, Gridly has no owned server-side geocoder, no address-specific fallback, no structured-address request, and no guarantee that a rural parcel is represented in OpenStreetMap. The reported production observation—highways but no requested address—is therefore a real failure of the end-to-end consumer capability, irrespective of integration presence.

The audit environment could not reach Nominatim: all six controlled requests failed before HTTP response with `Tunnel connection failed: 403 Forbidden`. That result is an environment limitation, not evidence that production Nominatim returned zero results. The supplied browser observation is the available browser-visible production evidence. LP096 therefore does **not** claim provider success or fabricate rural coverage.

Pressing **Search** does not take a different path: the current destination dialog has no Search button, form submission handler, or Enter-key handler. `type="search"` input events alone trigger a 350 ms debounced lookup. Enter has only the browser's default behavior and does not invoke a separate search.

### Finding classification

| Layer | Finding |
|---|---|
| Code capability | Present: local seeds/saved places merge with direct Nominatim search. |
| Provider capability | Nominatim accepts free-form addresses, but an individual rural address depends on OSM coverage and could not be verified from this environment. |
| Runtime request | Code attempts it after 350 ms and at query length ≥3; the passive helper reports whether the most recent attempt actually occurred. |
| Preservation/rendering | Coordinate-bearing provider rows normalize and can render; no address-type rejection exists for address intent. Only five results are retained/rendered. |
| Browser behavior | Reported production behavior showed highways, not the address. Runtime reproduction was blocked by the audit environment's outbound proxy. |
| Route handoff | A rendered row with finite coordinates is selectable and becomes `selectedDestination`; route preview then uses those coordinates. |

## 2. Current Destination Search Architecture

1. `#gridlyAddressSearchInput` is a plain `type="search"` input in the destination dialog. There is a Reset control but no submit/Search control.
2. On each `input` event, whitespace is trimmed and copied to in-memory `GridlySearchState.activeQuery`.
3. Queries shorter than three characters do not call the provider; saved places may render.
4. At three characters, the UI first renders “Checking nearby places…”, then schedules `runGridlyLiveDestinationSearch` after 350 ms. Focus/click can run the same live path immediately.
5. The live path may render matching local seeds/saved places immediately, then awaits `gridlySearchAddress` and replaces the results only if request ID and input text are still current. This stale-response guard is the debounce/cancellation mechanism; it does not abort fetch.
6. `gridlySearchAddress` classifies intent, generates local seed matches, and calls Nominatim. Address intent uses exactly one provider variant—the trimmed user query. Generic short queries may gain locality/county/Texas variants.
7. Provider rows must contain valid non-zero latitude/longitude to normalize. They are scored, optionally county-filtered only for generic Montgomery searches, deduplicated, limited to five, and rendered under “Best matches.”
8. A row click re-normalizes it, requires finite coordinates, assigns it to `selectedDestination`, creates/focuses a marker, closes search, and starts destination route preview generation.

There is no form, explicit submit handler, Enter-key handler, separate autocomplete endpoint, or submitted-search endpoint. Autocomplete and the only search path are the same debounced live lookup.

## 3. Current Provider Inventory

| Provider/source | Integration / endpoint | Complete street addresses | Rural county-road addresses | Production active | Runs when | Use | Consumer error visibility | Geography |
|---|---|---|---|---|---|---|---|---|
| Saved Places | `getGridlySavedPlaceDestinationSearchResults` in `js/app.js` | Only previously saved, coordinate-valid places | Only if already saved with coordinates | Yes, local | Empty/short query or matching live query | Suggestions/live search | No provider error concept | Not externally constrained |
| Gridly local POI seeds, including roadway seeds | `GRIDLY_LOCAL_POI_SEEDS` and `searchGridlyLocalPoiSeeds` | No general address index | No; only explicitly seeded records | Yes, local | Matching live query; immediate before remote completion | Suggestions/live search | Empty set is silent | Montgomery context can restrict seeds; otherwise regional seeds |
| OpenStreetMap Nominatim Search | `fetchGridlyNominatimSearch`; `https://nominatim.openstreetmap.org/search` | Provider supports free-form geocoding where OSM has adequate address data | Possible, not guaranteed; the example parcel is unverified | Integration is active in production source; actual request/response is runtime-dependent | Trimmed query ≥3, after debounce; not in cooldown; cache/inflight guards apply | The sole remote live-search path | Final empty message is visible; detailed failures are only console warning/runtime diagnostics | `countrycodes=us`; county `viewbox`; `bounded=0` for address/explicit intent, `bounded=1` only for generic intent in a bounded context |
| OpenStreetMap Nominatim reverse endpoint | `gridlyReverseGeocode`; `https://nominatim.openstreetmap.org/reverse` | Reverse lookup only | Not a typed destination-search provider | Active elsewhere | Explicit reverse-geocode calls | Neither autocomplete nor typed destination search | Console warning | No destination-search constraint |
| OpenStreetMap Nominatim saved-place geocoder | `geocodeAddressToCoordinates`; same `/search` endpoint | First-result coordinate resolution for saving a place | Coverage-dependent | Active for Manage Places | A save flow permits geocoding | Saved-place creation, not destination suggestions | Save-flow fallback/error handling | `countrycodes=us`, limit 1 |
| OSRM | `https://router.project-osrm.org/route/v1/driving` | No geocoding | Not applicable | Active route provider | After a coordinate-bearing destination is selected and origin resolves | Route handoff only | Route preview error state | Coordinates determine scope |

Nominatim is called directly from the consumer browser. Its request includes `q`, `format=jsonv2`, `limit=5`, `addressdetails=1`, `extratags=0`, `namedetails=0`, `countrycodes=us`, plus a county viewbox and bounded flag. The source implements a two-minute cache, 1,250 ms minimum interval, in-flight duplicate reuse, 30-second general failure cooldown, and two-minute 429 cooldown.

## 4. Address Search Capability

Address recognition is broad: a leading street number, a ZIP, or an address word (including road-style tokens) classifies the query as `address`. Classification does not itself improve geocoding. It chiefly prevents generic-local query expansion and generic-only quality suppression.

A provider result is accepted only if it has a valid, non-zero coordinate pair. There is no rejection based on Nominatim `class`, `type`, presence of a house number, Liberty County membership, or exactness for address intent. Thus a highway, ZIP centroid, road centerline, or exact house can all survive if Nominatim returns coordinates. This explains why source presence is insufficient proof of full-address support.

The renderer does not have an address-only row type. Nominatim `display_name` becomes the title when no shorter name exists, and address context is derived from the normalized/raw address. An exact result can therefore display, but may be visually verbose.

## 5. Example Query Trace

All requests below describe the current production-code path with default `limit=5`, `countrycodes=us`, the active county viewbox, and `bounded=0`. “Provider result” is **unknown**, not “none,” because the audit runner was denied outbound access before an HTTP response.

| Typed query | Intent/path | Final provider `q` | Local result expectation | External attempt | Exact/approx result | Normalize/rank/render/select/route determination |
|---|---|---|---|---|---|---|
| `274 county road 677` | Address; 350 ms live path | Unchanged | No matching complete-address seed identified | Yes | Unknown; reported production UI had none | If returned with coordinates it survives and is eligible for top five; production evidence says it was not rendered, so it could not be selected/routed in that run |
| `274 County Road 677, Dayton, TX` | Address; same path | Unchanged except trim | None expected | Yes | Unknown | Same conditional handoff; city context is passed, not stripped |
| `274 County Road 677, Dayton, Texas 77535` | Address; same path | Unchanged except trim | None expected | Yes | Unknown | Same; ZIP and full locality reach provider intact |
| `274 CR 677, Dayton, TX 77535` | Address because leading number/ZIP | Unchanged except trim | None expected | Yes | Unknown; abbreviation is not expanded | Same; Gridly does not translate `CR` to `County Road` |
| `County Road 677, Dayton, TX` | Address because address word | Unchanged except trim | A road seed would require query-token match; no parcel seed | Yes | Unknown; a road-level result is more likely than a house | Any coordinate-bearing road result can normalize/render/route, but it is not proof of a complete address |
| `77535` | Address because ZIP | Unchanged | None expected | Yes | Unknown; a postcode centroid is possible | A centroid can normalize/render/route but is not a complete street-address match |

For address intent, Gridly neither appends Dayton/Liberty/Texas nor rewrites the query. Locality context must be typed by the user. The short query is not automatically upgraded to the complete example address.

### Runtime provider probe

A controlled script constructed the same request parameters and attempted each query once, separated by 1.3 seconds. Every attempt failed at the environment tunnel with `403 Forbidden`; no Nominatim HTTP response or payload was received. This establishes neither provider success nor provider limitation for the parcel.

## 6. Seeded and Roadway Result Ranking

Saved places receive a +1000 score. Curated seed usefulness can add 8 for road/highway/transportation categories, but address intent does **not** get the large generic-local distance and seed boosts. Address/explicit results receive +25 in bounds, +12 Texas, +8 recognized locality, +6 within 75 miles, plus title-query matching (+28 exact, +20 prefix, +10 containment). Provider order contributes only a small index score.

Therefore roadway seeds are not categorically guaranteed to outrank an exact provider address. For this query, seed matching requires meaningful query/seed text overlap; no general county-address seed exists. If highways appear, likely explanations are provider road results, already rendered local interim evidence from a different runtime/version, or no exact address result in the final provider top five—not a renderer rule that discards addresses. The passive helper now reports whether roadway rows are present and ahead of a rendered address in the current in-memory result set.

Deduplication uses normalized displayed title plus rounded coordinates and stops at five. This can remove duplicates, but it does not specifically suppress addresses.

## 7. External Provider Behavior

The provider integration is present and invoked for live address queries. Actual operation depends on consumer network/CORS/provider availability. Failures degrade to local/saved results; if none survive, the user gets a generic “No matching places yet” message. Provider HTTP/error details are not shown to the consumer. A console warning is issued on thrown fetch errors, while structured diagnostics retain only current in-memory evidence.

Nominatim can geocode complete addresses represented in OSM, but this audit has no authoritative evidence that **274 County Road 677** is mapped or returned. Rural county-road naming and house-number coverage are data-dependent. Gridly makes no second provider request using structured `street`, `city`, `state`, or `postalcode` fields and has no county-address dataset fallback.

## 8. Address Normalization Findings

- Typed queries are trimmed but otherwise preserved for address intent.
- Display/search normalization lowercases, removes punctuation for token/ranking comparisons, and canonicalizes known brand aliases; this normalized value is **not** substituted for provider `q`.
- `CR` is not expanded to `County Road`.
- Provider latitude/longitude strings are converted to finite numbers; missing, zero, or invalid coordinates reject the result.
- Provider address objects, display name, type, ID, bounds, and raw payload are preserved.
- No exact-address validation occurs. A road or postcode response is treated as a routable destination if it has coordinates.
- Address results are not subject to generic-only far-away quality suppression or generic-only Montgomery containment filtering.

## 9. Rendering Findings

Live local matches may render immediately while Nominatim is pending. The completed current request replaces them. A request-ID and query equality guard prevents stale asynchronous responses from replacing results for newer text.

The completed set is normalized, merged with matching saved places, rescored, deduplicated, and capped at five. “Best matches” is a general label, not evidence of match precision. There is no hidden address-result section and no renderer rejection based on address type. Rows without valid coordinates never reach rendering because normalization removes them. Provider errors are generalized to an empty/unavailable message.

The reported highway-only screen proves that no valid address reached the visible final suggestions in that production observation. It does not, without runtime diagnostics, distinguish Nominatim empty/approximate output from a top-five ranking/deduplication outcome.

## 10. Route Handoff Findings

Clicking a rendered result resolves its array index against the last rendered in-memory set, requires finite coordinates, and calls `selectGridlySearchResult`. Selection sets `activeResult` and `selectedDestination`, updates the input label, creates a destination marker, closes results, and invokes `buildGridlyDestinationRoutePreview`. That preview uses the selected destination coordinate with the resolved origin and the OSRM route service.

Consequently, route handoff is not the cause of the reported missing suggestion. It is downstream and cannot run when the address never renders. If a genuine address row renders with finite coordinates, the same route path used by other destinations accepts it. This is code capability, not runtime certification of the example route.

## 11. Consumer Impact

An ordinary user can type an address, but cannot know whether an absent result means missing OSM data, provider/network failure, rate limiting, top-five approximation, or no match. The UI may show plausible highways under “Best matches,” encouraging selection of a corridor rather than the intended parcel. There is no explicit Search action to retry or broaden the lookup and no message explaining that locality/ZIP context may improve provider matching. This conflicts with the requirement that users should not need internal roadway knowledge or technical query syntax.

## 12. Root Cause

**Primary root cause:** Gridly delegates arbitrary address discovery to one direct-from-browser, free-form Nominatim request and treats any coordinate-bearing result as a destination; it has no reliable/owned full-address resolution contract or rural-address fallback.

**Example failure point:** The available consumer evidence shows that an exact address did not reach rendering. Source review rules out query replacement, a submit-only path, address-type normalization rejection, and route handoff as primary causes. The remaining unresolved runtime fork is: (a) Nominatim did not return the address in its first five rows, (b) direct provider access failed/was guarded, or (c) it returned an address below other results before the five-row cap. The new passive helper distinguishes these cases on the next browser run without creating requests.

**Not established:** This audit does not claim the provider lacks the parcel, because outbound runtime verification was unavailable.

## 13. Launch Risk Classification

**High.** Destination routing presents address search to consumers, but complete and rural address resolution is neither reliable nor observably explained. The risk includes incorrect corridor selection, inability to begin routing, browser/provider availability, public-endpoint policy/scale concerns, and absence of exactness validation.

## 14. Recommended Next Milestone

**LP097 — Compliant Address Resolution and Rural Route-Destination Certification.** The smallest safe milestone should:

1. put geocoding behind a Gridly-owned server/proxy boundary with an explicit usage policy and failure contract;
2. preserve free-form consumer input while adding address-specific query variants/structured fields (including `CR`/`County Road`) without silently changing intent;
3. return and rank exact house-number + road matches ahead of roadway approximations;
4. label approximate road/postcode matches distinctly;
5. expose consumer-safe provider unavailable/no exact address states;
6. test rural Liberty County fixtures without persisting private user input; and
7. certify selection coordinates and OSRM handoff on mobile portrait.

This should not alter routing calculations, Route Watch, saved places, awareness, or reporting.

## 15. Protected Systems Confirmation

LP096 changed only this audit document, a passive console snapshot helper, and a static audit test. The helper reads existing in-memory destination-search state only; it performs no fetch, persistence, route calculation, map mutation, or UI mutation. The following remain unchanged: Shared Reports; Route Watch; Awareness Filtering; Hazard Lifecycle; Alert Generation; Supabase Sync; Historical Intelligence; Official Source Integration; crossing interactions; Saved Places behavior/storage; and Home/Work personalization.

## 16. Files Inspected

- `index.html` — destination-search DOM; absence of Search/submit control.
- `js/app.js` — input/debounce, intent detection, seeds/saved places, Nominatim request/guards/cache, normalization, ranking/filtering/deduplication, rendering/selection, destination marker and route preview, saved-place geocoding, reverse geocoding, OSRM integration.
- `css/styles.css` — destination search presentation and portrait behavior (no logic finding).
- `docs/LP063-DESTINATION-INTELLIGENCE-DECISION-INTEGRATION.md` and recent milestone documents — documentation placement/style context.
- `package.json` and relevant tests — available test conventions/scripts.

No Supabase, alert, reporting, historical-intelligence, crossing, or Route Watch implementation was modified.

## 17. Tests Performed

1. `node --check js/app.js` — JavaScript syntax.
2. `node tests/lp096-destination-address-search-audit.test.js` — static contract: passive helper, required fields, no fetch in helper, provider/request guards, input/debounce path, absence of submit path, route handoff evidence, documentation sections, protected-system declaration.
3. `git diff --check` — whitespace/patch validation.
4. Controlled Nominatim probe for all six requested query variants — warning: environment tunnel returned 403 before provider response for every query.
5. Source trace with `rg`/`sed` over `index.html` and `js/app.js` — event, provider, normalization, rank, render, select, and OSRM handoff audit.

### Passive runtime helper

`window.gridlyDestinationAddressSearchAudit()` makes **zero network requests**. It snapshots the current query, intent, most recent provider diagnostics, currently rendered rows, address evidence, roadway ordering, selected-coordinate state, capability conclusion, launch risk, and recommendation. It intentionally reports support only after a current address-like query has a rendered address-shaped result; integration presence alone never produces success.

### Browser console certification

```js
(() => {
  console.clear();

  const audit =
    typeof window.gridlyDestinationAddressSearchAudit === "function"
      ? window.gridlyDestinationAddressSearchAudit()
      : null;

  const checks = {
    auditAvailable: !!audit,
    milestoneCorrect: audit?.milestone === "LP096",
    passive: audit?.passive === true,
    productionBehaviorUnchanged: audit?.productionBehaviorChanged === false,
    providerDeterminationAvailable:
      typeof audit?.externalGeocoderAvailable === "boolean",
    addressCapabilityDeterminationAvailable:
      typeof audit?.fullStreetAddressSearchSupported === "boolean",
    ruralAddressDeterminationAvailable:
      typeof audit?.ruralCountyRoadSearchSupported === "boolean",
    routeDestinationDeterminationAvailable:
      typeof audit?.selectedResultCanBecomeDestination === "boolean",
    launchRiskAvailable:
      typeof audit?.launchRisk === "string" &&
      audit.launchRisk.length > 0,
    recommendationAvailable:
      typeof audit?.recommendedNextAction === "string" &&
      audit.recommendedNextAction.length > 0,
    protectedSystemsUnchanged:
      audit?.protectedSystemsUnchanged === true,
    safeToProceed:
      typeof audit?.safeToProceed === "boolean"
  };

  const failedChecks = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);

  console.table(checks);
  console.log("Full LP096 audit:", audit);

  if (failedChecks.length) {
    console.error(
      "❌ LP096 BROWSER CERTIFICATION FAILED",
      failedChecks
    );
    return {
      passed: false,
      failedChecks,
      audit
    };
  }

  console.log(
    "✅ LP096 BROWSER CERTIFICATION PASSED — ADDRESS SEARCH CAPABILITY DETERMINED"
  );

  return {
    passed: true,
    failedChecks: [],
    audit
  };
})();
```

Passing this structural certification means the determination is available; it does **not** mean `safeToProceed` or address support is true. Inspect the full returned audit.

### Exact mobile portrait manual test

1. Open the deployed production build in a fresh private/incognito browser session and set responsive viewport to **390 × 844 CSS px** (portrait), or use a portrait phone.
2. Open DevTools **Network**, filter for `nominatim`, enable **Preserve log**, and do not enable request blocking.
3. Open Gridly and tap **Where are you going?**
4. Tap **Reset** so the destination field is empty.
5. Type `274 county road 677`; wait at least two seconds (350 ms debounce plus provider throttle/network).
6. Screenshot/record every visible “Best matches” row in order. In Network, record whether `/search` ran, its status, its decoded `q`, and response row count. Do not copy/store the address outside this temporary certification record.
7. Press the keyboard **Search/Enter** key once. Record whether any request starts or the result set changes. Expected from source: no separate submission path and no intentional change.
8. Run `window.gridlyDestinationAddressSearchAudit()` and record booleans/counts; redact `query` and `normalizedQuery` before sharing logs.
9. Reset and repeat steps 5–8 with `274 County Road 677, Dayton, TX`.
10. Reset and repeat with `274 County Road 677, Dayton, Texas 77535`.
11. For completeness, repeat with `274 CR 677, Dayton, TX 77535`, `County Road 677, Dayton, TX`, and `77535`.
12. If an exact address row appears, select it. Confirm the returned audit has `selectedResultHasCoordinates: true` and `selectedResultCanBecomeDestination: true`; confirm a destination marker/current route preview begins at the selected label and does not use a highway seed coordinate.
13. If only an approximate road/ZIP row appears, do not certify it as an exact address; record title, provider type, ordering, and helper flags.
14. Reset and type `US 90`; confirm the existing seeded highway result remains visible/selectable.
15. Smoke-check Shared Reports, Route Watch, awareness filter, one crossing interaction, Saved Places, Home, and Work without editing/resetting stored data.
16. Re-run the supplied console certification block. Certification is structurally passed only when all checks are true; merge readiness additionally requires reviewing `safeToProceed`, provider evidence, and the documented high-risk conclusion.

## Merge Recommendation

**Merge LP096 as an evidence/audit milestone** after the static checks and browser helper certification pass, because it does not change consumer search behavior or protected systems. Do **not** treat the merge as address-search launch approval. Keep full/rural street-address routing at high risk and schedule LP097 before claiming the capability to consumers.
