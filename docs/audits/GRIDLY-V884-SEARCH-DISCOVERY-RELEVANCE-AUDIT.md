# GRIDLY V884 — Search Discovery & Relevance Audit

## Scope

This milestone inventories and instruments the existing destination search pipeline. It does **not** redesign Search, replace providers, change routing, or modify Route Watch, Weather, Reporting, Community Pulse, Alerts, Supabase, map rendering, hazard lifecycle, or protected systems.

## Current Architecture

### Active providers

1. **Saved Places** — local-first source merged into rendered destination results when the query matches saved home/work/favorite places.
2. **Gridly local POI seed list** — curated in-app seed records for a small set of high-value brands and local destinations.
3. **OpenStreetMap Nominatim Search** — remote browser-side provider at `https://nominatim.openstreetmap.org/search` using `format=jsonv2`, `addressdetails=1`, `countrycodes=us`, query variants, optional `viewbox`, and `bounded` behavior.

### Request flow

1. User enters a destination query in the live search shell.
2. Query is trimmed and classified as `generic_local`, `explicit_destination`, or `address`.
3. Matching local POI seeds are collected first.
4. Query variants are generated for short generic local searches. Variants may include the awareness anchor/town, county, and Texas.
5. Each variant is requested from Nominatim subject to cache, cooldown, duplicate inflight suppression, and throttling.
6. Raw provider payloads and seeds are normalized into Gridly search result objects.
7. Results are ranked, bounded/quality-filtered where applicable, deduped, capped, and rendered.

### Response flow

1. Provider responses are normalized only if coordinates are present.
2. Display title, subtitle/context, provider, type, coordinates, bounds, confidence, and raw payload are retained.
3. Saved places are merged into render-time results.
4. Results are prioritized and stored in `gridlySearchUiState.lastRenderedResults` for selection.
5. Selecting a result drives the existing destination marker/route preview flow; V884 does not alter that behavior.

### Query normalization

Current stages:

- trim raw query
- lowercase and collapse whitespace
- strip apostrophes and punctuation for token matching
- brand alias canonicalization (`H-E-B` → `heb`, `Buc-ee's` → `buc ees`, etc.)
- address indicator detection
- destination/location indicator detection
- local expansion variants for short generic local queries
- provider payload normalization
- display label/context cleanup

### Filtering and ranking

Ranking uses these existing signals:

- saved place boost
- local POI seed boost
- provider order prior
- title/query match score
- awareness/county bounds match
- Texas/locality/Liberty County text match
- distance from map or awareness anchor
- far-away generic local suppression
- duplicate suppression by normalized title and rounded coordinates

Filtering includes:

- coordinate requirement during normalization
- Montgomery County bounded generic-local filter when Montgomery context is active
- generic-local quality filtering when local quality results exist
- dedupe before render
- result limit cap

### Result limits

- Render limit: 5.
- Provider request limit: up to 5 by default in live search, bounded between 1 and 10 inside `gridlySearchAddress`.
- Dedupe supports a capped maximum of 25 but the default render path uses the 5-result limit.

### Geographic bounding

- Base map context records map center and bounds, but `boundedSearchEnabled` is false there.
- Destination containment context can enable county-derived bounds when county metadata exists.
- Generic local searches can set Nominatim `bounded=1` when bounded containment is enabled.
- Explicit destination and address searches avoid the generic-local bounded behavior unless explicitly requested.

### Fallback behavior

- Saved places and local POI seeds can render even if the remote provider fails.
- Provider failures trigger cooldown diagnostics instead of throwing UI-breaking errors.
- Query variants broaden from local context to county/Texas to improve discovery.
- Duplicate inflight requests are reused.

### Caching

- Remote provider cache is enabled with a 2-minute TTL.
- Duplicate inflight requests are suppressed.
- Minimum remote provider interval is 1.25 seconds.
- Failure cooldown is 30 seconds; rate-limit cooldown is 2 minutes.

## Instrumentation Added

A console-safe, non-mutating helper is available:

```js
window.gridlySearchDiscoveryAudit?.()
```

It returns:

```js
{
  available: true,
  version: "V884-search-discovery-relevance-audit",
  providerInventory: [],
  providerCount: 0,
  normalizationStages: [],
  geographicFilteringEnabled: false,
  resultLimit: 5,
  rankingSignals: [],
  fallbackStrategy: "...",
  cacheEnabled: true,
  protectedSystemsUnchanged: true,
  recommendations: []
}
```

Additional audit helpers:

- `window.gridlySearchCertificationDataset?.()` returns the static certification dataset without network calls.
- `window.gridlyRunSearchCertificationAudit?.()` runs the certification queries through the current search pipeline and returns live observations.

## Search Certification Dataset

| Category | Query | Expected | Initial Finding |
|---|---|---|---|
| Businesses | Walmart | local business/brand result in or near the service area | Seed coverage exists for Cleveland and Liberty; should be strong. |
| Businesses | H-E-B | regional grocery result in or near the service area | Seed coverage exists for Mont Belvieu; ranking depends on active geographic context. |
| Businesses | Buc-ee's | regional travel center result in or near the service area | Seed coverage exists for Baytown; ranking depends on distance/local context. |
| Businesses | Tractor Supply | local hardware/agricultural retail result | Seed coverage exists for Liberty; should be strong. |
| Businesses | Home Depot | regional hardware retail result | Seed coverage exists for Baytown; may rank below closer provider results if context differs. |
| Public Places | Dayton City Hall | Dayton civic place | Likely provider-dependent; no dedicated seed observed. |
| Public Places | Liberty County Courthouse | Liberty civic place | Likely provider-dependent; no dedicated seed observed. |
| Public Places | Dayton High School | Dayton school | Provider-dependent; batch list previously includes this query but no dedicated seed observed. |
| Public Places | Liberty Hospital | Liberty-area hospital/medical result | Provider-dependent; hospital alias exists but no dedicated Liberty hospital seed observed. |
| Communities | Dayton | Dayton, Texas community | Provider-dependent but locality ranking signals should help. |
| Communities | Liberty | Liberty, Texas community | Ambiguous with county/city terms; locality ranking should help. |
| Communities | Cleveland | Cleveland, Texas community | Ambiguous nationally; locality ranking and Texas signals should help. |
| Communities | Conroe | Conroe, Texas community | Supported by destination location tokens and Montgomery context. |
| Communities | Baytown | Baytown, Texas community | Supported by destination location tokens. |
| Roads | US 90 | US 90 corridor | Address-word detection applies; result quality depends on provider road indexing. |
| Roads | TX 146 | TX 146 corridor | Provider-dependent and abbreviation-sensitive. |
| Roads | TX 321 | TX 321 corridor | Provider-dependent and abbreviation-sensitive. |
| Roads | FM 1960 | FM 1960 corridor | Address-word detection applies; provider may rank nonlocal road segments. |
| Crossings | Alabama Street Crossing | crossing if provider/index supports named crossings | Search provider likely lacks local crossing domain index. |
| Crossings | Main Street Crossing | crossing if provider/index supports named crossings | Ambiguous; likely needs domain data or UI clarification later. |

## Strengths

- Search already has multiple discovery inputs: saved places, curated local seeds, and remote provider results.
- Query diagnostics already capture provider status, cache hits, cooldown, throttling, duplicate suppression, quality filtering, and final result counts.
- Ranking includes locality, distance, Texas, and bounds-aware signals.
- Local seed results provide resilience when remote provider discovery is weak.
- The new audit helper exposes architecture without mutating runtime state.

## Weaknesses

- Civic places, schools, hospitals, roads, and crossings are mostly provider-dependent.
- Remote provider is called directly from the browser, which is risky for production compliance and rate limiting.
- Short generic searches can be sensitive to active awareness area and county bounds.
- Roads and crossings are likely under-indexed or ambiguously indexed by a generic geocoder.
- The local seed list is strong for a few businesses but not a comprehensive destination index.
- Certification observations require a browser/network run to record live `found`, `topResult`, and provider behavior.

## Discovery Gaps Identified

- **Expected result missing:** likely for named crossings and some civic/public places without local seed coverage.
- **Poor ranking:** possible for ambiguous communities such as Cleveland or Liberty and regional businesses outside the active county.
- **Over-filtering:** possible for generic-local searches when county bounding is active and the expected result is just outside the selected county.
- **Provider limitation:** likely for rail/crossing names, road corridors, and local civic destinations.
- **Normalization issue:** possible for highway abbreviations (`TX`, `FM`, `US`) and names with punctuation.
- **Geographic bound issue:** possible when explicit user intent points outside the active awareness area.
- **Duplicate results:** mitigated by title/coordinate dedupe, but provider county-only duplicates can still influence ranking before suppression.
- **Slow response:** throttle and provider cooldown protect the provider but certification runs may take time.
- **Ambiguous query:** community names and road names can resolve outside the intended local area without enough context.

## Recommendations

### High Impact / Low Risk

#### Data improvements

- Add non-runtime certification snapshots from browser validation so regressions can be reviewed without changing search behavior.
- Add curated entries for Dayton City Hall, Liberty County Courthouse, Dayton High School, local hospitals, and key roads/crossings in a future data-only milestone.

#### Ranking improvements

- Log per-query top result category and distance in QA runs to identify whether ranking or provider recall is the primary issue.
- Tune explicit-destination ranking to avoid over-penalizing valid regional destinations outside the active awareness area.

#### UI improvements

- Add QA-only copy or internal tooling that indicates when a result is seed, saved place, or remote provider.

#### Provider improvements

- Keep the current provider unchanged for this milestone, but document a proxy/provider compliance path.

### Medium Impact

#### Data improvements

- Build a small Gridly Places index for civic places, schools, hospitals, roads, and crossings.
- Add aliases for highway names and local shorthand.

#### Ranking improvements

- Separate scoring models for businesses, communities, roads, and crossings.
- Add category-specific tie breakers for exact brand/community/road matches.

#### UI improvements

- Add ambiguity handling for city-vs-county and road-vs-place queries.

#### Provider improvements

- Capture provider metadata consistently through a server-side proxy when approved.

### Long-term

#### Data improvements

- Maintain a first-party regional destination catalog with source attribution and update cadence.

#### Ranking improvements

- Introduce measurable relevance scoring with expected-result assertions from certification queries.

#### UI improvements

- Provide explainable search results for QA/admin users.

#### Provider improvements

- Evaluate a production-grade provider strategy or blended provider architecture behind a Gridly API.

## Protected Systems Confirmation

V884 changed only search audit instrumentation and documentation. It does not intentionally change runtime search behavior, routing, Route Watch, Weather, Reporting, Community Pulse, Alerts, Supabase, map rendering, hazard lifecycle, or other protected systems.

## Browser Validation Procedure

1. Open Search.
2. Run `window.gridlySearchDiscoveryAudit?.()`.
3. Optionally run `await window.gridlyRunSearchCertificationAudit?.()`.
4. Perform the certification searches manually.
5. Record `found`, `topResult`, `resultCount`, `providerUsed`, `normalizedQuery`, and notes.
6. Confirm no regressions to routing, Route Watch, Community Pulse, Alerts, Weather, or Reporting.
