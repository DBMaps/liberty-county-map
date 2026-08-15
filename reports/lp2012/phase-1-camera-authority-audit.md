# LP201.2 Phase 1 — Current camera authority and promotion-surface audit

## Status and scope

**OBSERVED.** This is an audit/design artifact. `runtimeActivation` remains `false`; no production runtime, registry, location-resolution, package, lifecycle, ZIP, awareness, Supabase, Route Watch, or deployment surface was changed. The audited baseline is branch `work`, commit `5d51eed099fac1da4aaea8186571a2a7b406eb85`, with that commit trivially an ancestor of HEAD. The pre-existing checkout is not clean only because `android/.gradle/`, `android/build/`, and `node_modules/` are untracked.

## Baseline verification

**OBSERVED.** All six certified files exist: `lp197-comparison.json`, `preflight.json`, `raw-named-place-points.geojson`, `reconciliation.json`, `review.json`, and `summary.json`. The summary records `runtimeActivation: false`, 1,859 canonical PLACEs, 1,559 resolved, and 300 unresolved. Recounting reconciliation records gives 1,253 A plus 306 C = **1,559**. This agrees with the summary; the phase therefore did not fail closed. The source identity remains 707,715,853 bytes and SHA-256 `1d80efe1b19b075d036363d722366870df3efb7fbd4a45dc9f16797868ff4413`.

## Current camera authority inventory

| Source | Fields / key | Nature and authority | Runtime consumers and lifecycle |
|---|---|---|---|
| `js/app.js` owner camera table; certified copy at `reports/lp197/governed-place-consumer-presentation-cameras.json` | `placeGeoid`; `lat`, `lng`, `zoom`, `source`, `ownerApproved` | Manual, owner-approved, production authority. Four exact records: Austin `4805000`, Dallas `4819000`, El Paso `4824000`, Fort Worth `4827000`. | `gridlyGetGovernedPlaceConsumerPresentationCamera` is the first PLACE branch in `gridlyDispatchSemanticCamera`; affects startup restoration, confirmed/manual PLACE selection, and ZIP selection when those resolve to the PLACE. It overrides the statewide target.
| `data/generated/gridly-statewide-place-presentation-v1.json` | object keyed by PLACE GEOID; `lat`, `lon` | Generated production fallback for all 1,859 canonical PLACEs, sourced from Census 2025 TIGER/Line `INTPTLAT/INTPTLON`. No zoom field. | Loaded by `gridlyLoadStatewidePlacePresentation`; second PLACE branch in the semantic dispatcher. Coordinates affect the same selection/startup paths. Zoom is supplied separately as 13.
| `data/generated/gridly-statewide-consumer-community-projection-v1.json`, projected into county `consumerAwarenessAreas` in `js/app.js` | `placeGeoid`, `displayName`, `governedType`, `countyMemberships`, optional `focus` (`lat`, `lng`, `startupZoom`, `source`) | Generated identity/membership production registry. Optional focus exists for bridge/default communities, but it is not the normal canonical PLACE camera once a valid GEOID reaches the dispatcher. | Resolves and validates manual and persisted identities. Its focus can seed an area and is a fallback only where the canonical target is unavailable/not loaded.
| `GRIDLY_AWARENESS_AREA_DEFINITIONS` and `GRIDLY_V905_COMMUNITY_MAP_FOCUS` in `js/app.js` | name/key/county; `lat`, `lng`, `startupZoom`, `source` | Historical/manual production community anchors, including Dayton/Liberty and numerous county waves. Some entries are non-Census communities. | Identity resolution and non-GEOID community fallback; coordinates do not beat owner or statewide PLACE cameras for a valid canonical GEOID.
| County geometry and county awareness bounds (`assets/location-resolution/`, county boundary assets, `GRIDLY_COUNTY_AWARENESS_BOUNDS_BY_ID`) | county FIPS/id; geometry/bounds | Production county-wide framing, not PLACE authority. | County-wide selections use authoritative geometry `fitBounds` with chrome padding and max zoom 10; asynchronous geometry load may issue the fit later. It is explicitly blocked while a confirmed PLACE camera transaction owns the viewport.
| ZIP indexes/overrides (`data/gridly-zip-awareness-index-v*.json`, `data/gridly-consumer-zip-overrides-v1.json`) | ZIP to county/community/awareness keys | Production identity selection, not direct camera evidence. | ZIP confirmation creates a governed home record; the resulting area then enters the same semantic camera dispatcher. ZIP does not directly override lat/lon/zoom.
| persisted `gridlyHomePersonalizationV1` plus compatibility `gridlyHomeTown`, `gridlySettingsV1`, profile | PLACE/community/county identity and memberships; no viewport coordinate or zoom | Production semantic persistence. | Read and validated before map construction; restores identity, then recomputes the current governed camera. It does **not** persist arbitrary map center/zoom, which preserves Dayton's repaired lifecycle.
| LP199 report | `currentCamera`, geometry candidates, `selectedCamera`, diagnostics, provenance | Generated evidence-only derivation. It retained existing cameras and recommends no runtime activation. | No production read found.
| LP200 report | address/populated-core signal, coverage, fallback model | Generated evidence-only certification; populated-core evidence is largely unavailable and is not activated. | No production read found.
| LP201.1 reports | selected OSM evidence and comparisons | Certified evidence-only; `runtimeActivation: false`. | No production read found.
| San Antonio/Houston region definitions | region identity; `lat`, `lng`, `startupZoom`, governed geometry | Production special-framing authorities distinct from canonical PLACE cameras. | Region selection takes the first, dedicated branch of the semantic dispatcher. These are not eligible to be replaced by a PLACE anchor.
| Other map movements (destinations, alerts, crossings, hazards, Route Watch) | feature coordinates and feature-specific zoom | Production feature camera owners, but not sources for a canonical PLACE presentation camera. | May move the map after explicit feature interactions; they are outside LP201.2 PLACE promotion.

**DERIVED.** LP197 is both a certification/reference artifact and the source-equivalent record of four manually governed production cameras. It is not merely calibration evidence: the same four values are embedded in the runtime table and are selected before the statewide fallback.

## Actual runtime decision paths

### First startup and reload

1. Startup reads and validates `gridlyHomePersonalizationV1` by canonical identity; compatibility settings/profile are secondary area-resolution inputs.
2. Before map construction, the validated record becomes `gridlyStartupSemanticContext` and active county context.
3. `initMap` chooses the persisted semantic area, otherwise the selected home-town awareness anchor.
4. `gridlyDispatchSemanticCamera` selects a dedicated San Antonio region camera; otherwise for canonical PLACE GEOID selects owner camera, then loaded statewide Census target; otherwise a non-GEOID area's own coordinates; county-wide identity uses geometry bounds.
5. `setGridlyAwarenessView` calls Leaflet `map.setView`; county-wide calls `map.fitBounds`. If no startup semantic camera is available, `defaultCenter` at zoom 13 is used.
6. Reload restores semantic identity, not a free-form viewport. It recomputes lat/lon/zoom from the current authority tables. No post-load generic PLACE recenter with a different precedence was found; delayed county geometry fitting is confined to county-wide selection.

### Manual PLACE selection

The picker/search resolves a canonical PLACE and persists a validated home record. `gridlyApplyConfirmedHomePersonalization` begins a PLACE-owned camera transaction, performs identity/settings writes and support hydration, and finally dispatches the PLACE camera. County `fitBounds` is blocked during that transaction, preserving the Dayton lifecycle repair. Canonical multi-county selections persist `identityType: PLACE_GEOID`, GEOID and complete membership array; they use the same dispatcher.

### ZIP selection

The ZIP resolver selects identity, not camera. After required confirmation/governance, it produces the same home-personalization record and runs the same final semantic dispatch. Thus a ZIP-selected canonical PLACE has the same camera precedence as manual PLACE selection; unresolved/ambiguous ZIPs do not manufacture a camera. County-wide fallback follows the county geometry path.

### Representative paths

Dayton `4819432`, Tyler `4874144`, Waco `4876000`, Corpus Christi `4817000`, and Liberty `4842568` use statewide Census lat/lon plus zoom 13 when the artifact is loaded. Austin, Dallas, El Paso, and Fort Worth use their LP197 owner-approved lat/lng/zoom 13 overrides. The cities share the semantic dispatcher but exercise two distinct coordinate-authority branches. Special Houston/San Antonio subregions are a third, non-PLACE identity path.

## Current precedence and fallback hierarchy

**OBSERVED.** For startup, manual canonical PLACE, ZIP-confirmed PLACE, and reload, the PLACE hierarchy is: (1) dedicated governed region when the selected identity is a region, not a PLACE; (2) LP197 embedded owner-approved camera by GEOID; (3) statewide generated Census `INTPTLAT/INTPTLON` target by GEOID; (4) area/community lat/lng for a non-GEOID specific area; (5) county geometry `fitBounds` for county-wide identity; (6) initial `defaultCenter`, zoom 13, only if no semantic camera issues. Bounds do not frame a canonical PLACE. Persistence sits before this hierarchy as identity authority and does not override coordinates.

## Higher-authority and manual inventory

**OBSERVED.** The exact higher-authority canonical PLACE set is Austin, Dallas, El Paso, and Fort Worth. Each is owner-approved and zoom 13 in LP197 and the runtime. Any A/C promotion must mark these four ineligible for automatic replacement. Separately, Houston and San Antonio region cameras are governed special identities; LP201.2 must not collapse a selected region into its parent PLACE. Historical area anchors remain authoritative for non-GEOID community identities and must not be rewritten by a canonical PLACE promotion.

## LP201.1 A/C promotion input assessment

**OBSERVED.** Every reconciliation record provides `bucket`, `candidateEligibility`, `candidates`, `canonical`, `reasons`, and `selectedOsmId`. Canonical data provides `placeGeoid`, `name`, `governedType`, and `countyMemberships`. Each candidate provides `osmId`, `name`, `normalizedName`, OSM `place` class, `lat`, `lon`, `insideCanonicalGeometry`, `countyAgreement`, `statewideSameNameCount`, and optional distances to LP199/LP200. `reasons` supplies exact-name, unique/disambiguation, eligible-class and polygon-selection evidence. Document-level `source` links the frozen OSM source and hashes.

**DERIVED.** The artifact is sufficient to deterministically construct candidate rows without rereading the PBF: the selected ID joins to retained candidate coordinates/classification, while record and document fields carry canonical identity and provenance. A future builder must fail closed if the selected ID is absent/duplicated or does not join exactly one candidate.

## Initial eligibility boundary

**DERIVED.** A and C are the only initial automatic candidate classes (1,559 total); B/D/E/G/H remain ineligible and F is orphan accounting. However, A/C does not mean automatically promotable:

* Exclude the four LP197 owner-approved cameras. All four are themselves A/C: Austin C, Dallas C, El Paso C, Fort Worth A.
* Exclude an active dedicated region identity from parent-PLACE substitution; this is an identity-path rule, not a statewide PLACE-record deletion.
* Preserve the current zoom authority rather than inferring zoom from OSM.
* Require deterministic GEOID linkage to the existing 1,859-target production artifact and consumer projection.

No repository evidence supports blanket exclusions merely for CDP status or multi-county membership; those identities are explicitly governed. Visual review remains required, so remaining A/C rows are WhatIf candidates, not certified production promotions.

## Zoom governance

**OBSERVED.** Normal canonical PLACE zoom is globally 13: statewide targets have no zoom and the dispatcher supplies `GRIDLY_TOWN_STARTUP_ZOOM` (13). The four owner cameras explicitly supply 13. Historical/non-GEOID areas vary (commonly 13/14), county-wide framing is bounds-derived with maximum 10, and governed city subregions commonly use 14. Explicit feature interactions can use other zooms. Reload does not preserve an arbitrary prior zoom; it restores semantic identity and recomputes its governed zoom.

**DERIVED.** An LP201.1 anchor could technically replace only fallback lat/lon while preserving zoom 13, but only through a future guarded artifact and resolver change. It must never replace owner camera coordinates, derive zoom from the OSM point, or affect region/county framing.

## Representative future visual validation cohort

* Dayton — lifecycle regression control and ordinary A fallback.
* Tyler — C duplicate-name disambiguation and ordinary statewide fallback.
* Waco — A major-city fallback.
* Corpus Christi — A, coastal/elongated and four-county identity risk.
* Austin — C plus multi-county and LP197 owner override.
* Dallas — C plus LP197 owner override/major metro.
* El Paso — C plus LP197 owner override/border-city morphology.
* Fort Worth — A plus LP197 owner override and five-county membership.
* Liberty — C, local historical-anchor comparison without reopening lifecycle code.
* Abbott `4800100` — rural incorporated A.
* Acala `4801084` — CDP A.
* Houston parent PLACE plus one governed Houston region — special-framing identity separation.
* Kyle `4839952` — genuine B unresolved negative control; must produce no candidate.

Austin/Fort Worth already cover multi-county risk. Expected coordinates must be read from governed inputs during validation, not manually fabricated in a test oracle.

## Protected runtime surfaces

**OBSERVED.** Phase 1 changed none of: `js/app.js`, `js/gridlyPackageRegistry.js`, `assets/package-registry/runtime-package-registry.json`, `assets/location-resolution/`, `data/generated/`, ZIP indexes/overrides, county/community packages, `data/runtime/`, HTML/CSS, service worker/deployment files, or remote services. Additional camera-sensitive surfaces to protect are the generated place presentation and community projection artifacts, LP197 runtime table, persisted-home schema/validation, semantic dispatcher/transaction, awareness definitions, region registries/geometries, county geometry loader, and map initialization.

## Proposed LP201.2 promotion-candidate artifact

**PROPOSED.** Use schema `gridly.lp2012.place-anchor-promotion-candidates.v1` with top-level `schemaVersion`, `generatedFrom` (git commit and hashes for LP197, current presentation, projection, reconciliation, summary), `counts`, `rules`, `records`, and `runtimeActivation: false`. Each GEOID-sorted record should contain:

* `canonical`: `placeGeoid`, name, governed type, sorted county memberships;
* `currentCamera`: lat/lng/zoom, authority enum and source path/hash;
* `namedPlaceCandidate`: LP201.1 bucket, selected OSM ID/class/name/lat/lon, reasons and polygon/name/disambiguation facts;
* `sourceIdentity`: frozen PBF path, bytes, SHA-256, reconciliation hash;
* `comparison`: deterministic geodesic distance and identity/coordinate validity;
* `governance`: `higherAuthorityCamera`, matching authority ID, special-framing flags, zoom policy, fallback authority;
* `eligibility`: boolean, decision (`PROPOSE`, `RETAIN_CURRENT`, `UNRESOLVED`, `REVIEW_REQUIRED`), stable reason codes;
* `proposal`: lat/lng or null, `preservedZoom`, never OSM-derived zoom;
* `facts`: separately labeled `observed`, `derived`, and `proposed` fields.

Rules: fail closed on hash/count/schema drift; exact GEOID join; only A/C may reach `PROPOSE`; four LP197 rows must retain current; B records including Kyle/Pecan Plantation/Runaway Bay/Sherwood Shores must be unresolved; region identities remain outside PLACE replacement; preserve zoom; no runtime writes; deterministic ordering/serialization; WhatIf diff plus visual-review status required before any apply design.

## Decision

### GO — SAFE TO BUILD GUARDED STATEWIDE WHATIF

**DERIVED.** The authority chain is deterministic enough for a non-activating WhatIf: canonical identity, four manual overrides, statewide fallback coordinates, fixed fallback zoom, persistence semantics, and county/region separation are explicit. The WhatIf must encode the exclusions and produce `runtimeActivation: false`; it is not authorization to patch production. A separate certification is required **after** WhatIf and visual review, before any activation, but no missing layer blocks building the WhatIf itself.

## Phase 1 checks

The certified LP201.1 verifier and tests, LP197 test, LP196 identity test, statewide runtime parity test, and LP199/LP200 verification/tests are the relevant non-mutating checks. Final Git diff/status must distinguish this tracked audit report from the checkout's pre-existing untracked build/dependency directories.
