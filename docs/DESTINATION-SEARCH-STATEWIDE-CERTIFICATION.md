# Statewide destination-search locality certification

## Decision and failure classification

The Baytown/Walmart failure was both `CANDIDATE_COVERAGE_OR_RETRIEVAL_DEFECT` and `SEARCH_CONTEXT_OWNERSHIP_DEFECT`. The two visible records came from `GRIDLY_LOCAL_POI_SEEDS` (`official_store_locator` seed provenance), a legacy Southeast Texas static inventory containing Liberty and Cleveland but no Baytown Walmart. They were therefore the entire local pre-ranking Walmart candidate set (2 → 2). No Baytown candidate existed at that boundary. The remote path also appended a hard-coded “Liberty County Texas” query variant and bounded generic discovery to the selected operational county. That could defeat a canonical Baytown focus spanning Chambers and Harris counties.

This repair does **not** add Baytown or Walmart records. It makes canonical PLACE presentation coordinates the locality authority, asks the live Gridly geocoder for the canonical locality first, removes the Liberty/default and operational-county narrowing, retrieves up to 15 provider candidates, ranks the complete pool, deduplicates, and only then truncates to five visible Best Matches.

## Exact production chain and count evidence

| Stage | Input → output | Identity/anchor | Source and count reason |
|---|---:|---|---|
| Text normalization | 1 → 1 | current search | case-fold, trim, collapse whitespace, aliases |
| Context resolution | 1 → 1 | selected canonical PLACE; PLACE GEOID when available | `getGridlySelectedAwarenessArea`; not map pan/GPS/county |
| Provider variants | 1 → 1–3 | canonical presentation lat/lng | canonical locality query first, then unbounded Texas expansion |
| Retrieval | variants → 0–45 plus matching seeds/saved places | same canonical anchor in request context | Gridly geocoding client (live, statewide contract), saved places, legacy static seeds |
| Normalization | all → coordinate-valid canonical results | no identity change | provider-to-legacy adapter and result normalizer |
| Eligibility | normalized → truthful relevant results | Texas/canonical context, not county membership | relevance/quality gates; explicit out-of-area intent preserved |
| Distance/scoring | N → N | Haversine from canonical presentation coordinate | text + continuous distance + validity + source confidence |
| Ranking | N → N | stable score, distance, provider order | governed Best Matches order |
| Deduplication | N → ≤15 | normalized name + coordinate/provider identity | duplicates suppressed after ranking |
| Truncation | ≤15 → ≤5 | unchanged | presentation limit only after ranking/deduplication |

The first quality-loss boundary was static local retrieval: its complete Walmart pool contained Liberty and Cleveland only. The second defect was provider query construction, where Liberty County/default ownership and county bounding could prevent the live provider from recovering the missing local candidates.

## Baytown canonical context

Baytown's canonical identity is PLACE GEOID `4806128`, consumer label `Baytown`, with memberships in Chambers (`48071`) and Harris (`48201`). Its LP201 presentation coordinate is approximately `29.7355047, -94.9774274` (the runtime consumes the certified value rather than a city-specific search constant). Operational county remains operational metadata. Search distance origin is the canonical presentation coordinate; manually panning the map does not change it. Map center is a presentation fallback only when no canonical selection exists. Nearby/route origin GPS remains separate and does not own Area destination discovery.

The failed build's map could visually center on Baytown while static candidates remained authoritative. After repair, `geographicAuthority` is `canonical_place_presentation`; the audit includes the exact runtime anchor. Search expansion is provider-driven and unbounded by county, so adjacent-county candidates remain eligible.

## Source inventory and statewide coverage

| Source | Geography/liveness | Fields | Runtime role |
|---|---|---|---|
| Saved places | consumer-specific, persisted | identity, name, coordinates, address | active; exact consumer destinations |
| `GRIDLY_LOCAL_POI_SEEDS` / LP097 curated | historic Southeast Texas, static | name/category/address/source/coordinates | active immediate/offline supplement; **not statewide business coverage** |
| Gridly geocoding client (`gridly-geocode`) | live external retrieval; statewide runtime request contract | canonical identity/name/type/address/coordinates/provider diagnostics | active on explicit Search/Enter; authoritative broad discovery |
| Recent searches | consumer session/persisted presentation | prior normalized results | UI convenience only; not authoritative retrieval for a new query |

The ranking contract applies uniformly to all 1,859 canonical communities, 2,058 memberships, 254 counties, and all 163 multi-county PLACE identities because it keys and anchors by canonical PLACE identity/coordinate, never first county membership. **Statewide current-business coverage is conditional on the live provider.** Static seed coverage remains regional and cannot independently certify current statewide businesses. No current businesses were invented for deterministic tests.

## Ranking, fallback, cache, and Best Matches contracts

A candidate receives independently auditable components: normalized title/query relevance, coordinate/validity status, bounded source confidence, and Haversine distance from the governed anchor. Distance contributes continuously (`150 - 3 × miles`, bounded at −120) alongside text relevance. Thus equally relevant valid candidates deterministically favor the closer candidate. A nearby partial match can reasonably compete with a farther exact match; distance is important but not exclusive.

The provider pool may expand from canonical-local query to Texas query when no sufficient local pool exists. Farther results are retained only as an explicit expansion outcome. Ranking precedes deduplication and the five-result truncation. “Best Matches” therefore never means provider order, alphabetical order, package order, fixture order, or arbitrary first N.

Provider cache identity already contains query, request limit, geographic viewbox and bounded mode. The shared contract additionally defines `query|canonicalCommunityKey/PLACE GEOID|anchor lat/lng|mode`; tests prove Baytown→Liberty and other transitions cannot share a geographically authoritative cache entry. County order is intentionally absent for multi-county PLACE identities.

## Read-only browser evidence

`gridlyDestinationSearchAudit("walmart")` returns only the last completed matching search snapshot and never initiates a request, changes the input, renders results, or mutates search state. It reports canonical community/key/GEOID, authority, anchor, source, pre-ranking/ranked/visible counts, and each candidate's identity, name, locality, coordinates, distance, text component, score components, final rank, deduplication identity, visibility/suppression, and reason. A mismatched query returns `query_not_last_completed_search` rather than changing state.

## Deterministic statewide controls

The pure contract is city-agnostic. Tests exercise case/whitespace normalization; exact matches at about 2, 25 and 60 miles; a partial match at about 1 mile; empty retrieval; duplicate inputs; transition/cache isolation; and a multi-county identity whose county order cannot alter cache identity. The same canonical registry supplies Baytown, Dallas, Houston, Austin, El Paso, McAllen, Amarillo, Liberty, Talco, rural, border, and multi-county controls. No production branch names any control city or brand.

## Baytown before/after and public acceptance control

Before: static pre-ranking candidates were Liberty and Cleveland; no Baytown Walmart candidate was retrievable locally, and a Liberty County provider expansion could reinforce that defect. After: the live provider is queried first for `walmart near Baytown Texas`, using Baytown's canonical coordinate, all returned candidates are distance-scored before truncation, and an equally relevant materially closer provider candidate must precede Liberty/Cleveland.

The owner-supplied current public controls (4900 Garth Rd and 8700 N Highway 146) remain external acceptance evidence only and are absent from production data. Network web verification was attempted during certification but the browsing service returned HTTP 401; owner browser/provider output must therefore complete the current-location acceptance check. This implementation does not claim a frozen live result count.

## Exact owner browser retest

1. Select **Baytown** and confirm **BAYTOWN CONTEXT**.
2. Open **Where are you going?**, enter `walmart`, and press Search/Enter (live provider search is explicit).
3. Run `gridlyDestinationSearchAudit("walmart")` in DevTools.
4. Confirm `canonicalCommunity === "Baytown"`, `placeGeoid === "4806128"`, `geographicAuthority === "canonical_place_presentation"`, and the anchor matches the current canonical presentation coordinate.
5. Confirm local Baytown candidates, when returned with equivalent text validity, have shorter `distanceMiles`, higher governed locality score, and ranks ahead of materially farther Liberty/Cleveland candidates.
6. Confirm `preRankingCandidateCount >= rankedCandidateCount >= visibleResultCount`, all visible candidates say `governed_best_match`, and Best Matches follows `finalRank`.
7. Transition Baytown→Liberty→Baytown, repeat Search, and confirm the final anchor/key is Baytown with no previous candidate or distance authority.

## Readiness decision

The statewide **ranking and context-ownership contract is ready**: canonical PLACE focus, transition isolation, multi-county behavior, distance evidence, rank-before-truncate, and auditability are deterministic. Statewide **candidate coverage remains live-provider dependent** and cannot be certified from the regional static inventory alone. Final owner review must execute the live Baytown control and representative provider searches. Weather/NWS and LP215 must **not** begin until the owner accepts that live-provider evidence; this milestone does not modify either system, DriveTexas, crossings, roadway runtime, LP201 coordinates, or memberships.
