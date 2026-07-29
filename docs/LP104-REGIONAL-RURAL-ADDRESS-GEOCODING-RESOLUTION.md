# LP104 — Regional rural address geocoding resolution

## Decision status

**Architecture and fail-closed implementation are ready; paid-provider activation and product certification are not approved.** No key, billing account, private address, or private coordinate is committed. Consequently LP104 must not be described as meeting the final production gate until the owner completes the live steps below and the browser certification returns `failedChecks: []` and `safeToMerge: true`.

## 1. Exact current-stack root cause

The server-side `gridly-geocode` Edge Function is the sole browser boundary. Its current default primary is the public OpenStreetMap Nominatim search endpoint (`jsonv2`, structured fields for addresses, `q` otherwise, US filter, optional viewbox). Nominatim results are canonicalized as address points only when the payload contains `address.house_number`. The existing rural fallback is the Census Geocoder one-line geographies endpoint using `Public_AR_Current` / `Current_Current`. Between them LP103 placed a service-role-only verified registry.

The failure is a source coverage failure: many rural residences do not have an OSM address node, while Census geocodes street ranges and can interpolate a different number on the correct road. LP102 correctly blocks that mismatch. Normalization cannot manufacture an absent address point, and the LP103 registry requires individual enrollment, so neither is a regional consumer solution. The public Nominatim service also has a one-request-per-second policy and forbids systematic use, making it an unsuitable sole production SLA even where its data is adequate.

Before LP104 the order was Nominatim → protected registry → Census range → no result. LP104 adds an independently enabled commercial rooftop tier and makes rural candidates from both primary and commercial sources pass the same house, canonical road, geography, precision, and containment gate.

Current caches are server-side Supabase rows: successful addresses live six hours, business results 24 hours, and no-results 60 seconds. The normalized request, provider namespace, and request mode form the SHA-256 cache key. Provider payloads and secrets do not cross the Gridly boundary. A provider contract must explicitly permit this six-hour operational cache before activation; otherwise TTL must be reduced to its permitted value.

## 2. Provider and dataset comparison (procurement snapshot, 2026-07-29)

The integrated web search service returned HTTP 401 and direct official-site requests returned proxy HTTP 403 during this work. Therefore the table records public product positioning and previously published list prices, but **no price or legal term is represented as freshly contract-verified**. The owner must obtain a current quote/order form and counsel review. Official review links are included so procurement can verify the exact terms on the approval date.

| Option | 28-county / rural fitness | Precision | Published price snapshot | caching, proxy, ingestion, attribution and production conclusion |
|---|---|---|---|---|
| Google Geocoding API | Statewide commercial coverage; strongest practical first pilot for heterogeneous County Road/FM/SH addressing. Coverage is not a contractual guarantee. | `ROOFTOP`, range-interpolated, geometric center, approximate; LP104 admits only rooftop; geometric-center, approximate, and range-interpolated results are rejected. | Essentials SKU historically included 10,000 free monthly requests, then $5/1,000 through 100k and tiered discounts; verify the current calculator. Illustrative 25k = $75/month and 100k = $450/month under that schedule. | Server-side key restriction is supported. Google content retention, display, attribution, and use with non-Google routing/maps require contract review. No batch ingestion. Operational response caching must match policy. **Recommended technical pilot, conditional on written approval.** [Pricing](https://developers.google.com/maps/billing-and-pricing/pricing), [policies](https://developers.google.com/maps/documentation/geocoding/policies), [API limits](https://developers.google.com/maps/documentation/geocoding/usage-and-billing). |
| HERE Geocoding & Search | Broad statewide commercial street/address coverage; pilot against the same suite. | House-number/address results and result scoring; verify rooftop semantics for Texas rural records. | Account/plan-based; obtain a current quote and transaction allowance. | Server-side proxy generally available; storage, derived-data, attribution and route use are contract-specific. No assumed bulk rights. [Documentation](https://www.here.com/docs/bundle/geocoding-and-search-api-v7-api-reference/page/index.html), [pricing](https://www.here.com/get-started/pricing). |
| TomTom Search/Geocoding | Broad US coverage; rural address-point success must be empirically measured. | Address/house number with match type; rooftop guarantee not assumed. | Freemium/usage tiers change; current account quote required. | Proxy supported with a protected key; caching, attribution and batch rights require terms review. [Geocoding](https://developer.tomtom.com/geocoding-api/documentation/geocode), [pricing](https://developer.tomtom.com/store/maps-api). |
| Mapbox Search Box / Geocoding v6 | Broad US coverage and secondary address data; test rural points explicitly. | Address features and routable points where supplied. | Temporary/permanent pricing and free tiers differ; obtain current SKU price. | Temporary results historically cannot be retained; permanent mode is separately billed/licensed. Attribution and map-display rules apply. No unlicensed ingestion. [API](https://docs.mapbox.com/api/search/geocoding/), [pricing](https://www.mapbox.com/pricing/). |
| Esri World Geocoding Service | Statewide composite locator, viable pilot and common in government GIS. | Point/address/range with `Addr_type` and match scores; point accuracy varies by source. | Historically 40 ArcGIS credits/1,000 geocodes; credit cost depends on subscription. | Stored/batch geocoding consumes credits and requires the appropriate ArcGIS entitlement; attribution and non-Esri display terms need review. Server proxy is possible with app credentials. [Service](https://developers.arcgis.com/rest/geocode/), [credits](https://doc.arcgis.com/en/arcgis-online/administer/credits.htm). |
| Smarty US Street + US Rooftop Geocoding | USPS-oriented validation plus rooftop product is attractive for deliverable rural residences; run head-to-head with Google. | Delivery point plus rooftop/parcel/ZIP precision metadata depending on product. | Free and paid subscriptions are volume/product-specific; obtain a written quote for Rooftop plus Street. | Server authentication supported; storage, batch, redisplay, attribution and routing rights must be in the order form. [US Street](https://www.smarty.com/docs/cloud/us-street-api), [Rooftop](https://www.smarty.com/products/us-rooftop-geocoding), [pricing](https://www.smarty.com/pricing). |
| Precisely APIs / Spectrum | Enterprise parcel, address and geocoding portfolios may offer excellent rural reference data. | Rooftop, parcel and street depending on licensed dataset. | Quote-only for the required coverage/rights. | Strong enterprise option if an SLA and all-county coverage schedule are supplied; bulk/cache/derived-data rights are contract-specific. [Geocoding](https://www.precisely.com/product/precisely-apis/geocode-api). |
| Melissa Global Address / Geocoder | US address verification/geocoding candidate; validate County Road aliases and entrance accuracy. | Address validation plus geocode precision codes. | Credit/subscription pricing varies; obtain quote. | Server-side use expected; retention, batch and redisplay require written terms. [Global Address](https://www.melissa.com/data-verification/address-check), [pricing](https://www.melissa.com/pricing). |
| Geocodio | US-focused, inexpensive and simple server API; useful benchmark, but rooftop rural coverage must win the suite before selection. | Rooftop/range accuracy types and optional Census/parcel fields. | Published pay-as-you-go has historically been $0.50/1,000 after 2,500 free/day; verify current price and feature charges. Illustrative 100k/month above a fully usable free allowance is about $12.50, but traffic distribution changes this. | Batch API exists. Terms must confirm cache, routing and parcel-field retention; server proxy supported. [Pricing](https://www.geocod.io/pricing/), [docs](https://www.geocod.io/docs/). |
| Texas statewide / TxGIS / emergency addressing | No single publicly verified, current, licensed statewide residential address-point package was found in the repository or accessible during this run. Next Generation 911 data access commonly has public-safety/privacy restrictions. | Potentially authoritative E911 entrance/address points if released. | Agency agreement/data engineering rather than per-call price. | Best authority if TDEM/TxGIS supplies all 28 counties with written consumer-production, redisplay, retention and routing rights. Do not infer a license from a viewer. [TxGIS](https://tnris.org/), [Texas 9-1-1 entities](https://www.csec.texas.gov/9-1-1-entities/). |
| County E911/CAD/parcel points | Potentially highest local authority, but fragmented schemas, refreshes and rights across 28 counties. Parcel situs/centroid is not automatically an entrance. | E911 point, parcel centroid, or situs depending on county. | Usually agreement/records costs plus ingestion operations. | Only viable regionally under one common contract: stable ID, full normalized address, aliases, county, ZIP, point, precision/source, effective date, license and tombstone. All 28 packages must certify before activation; no one-off Liberty path. |
| Regional councils (H-GAC and peers) / ArcGIS FeatureServers | May aggregate roads/address points, but public viewers do not imply bulk-production rights. Multiple councils cover this footprint. | Dataset-specific. | Usually agreement/hosting cost. | Discover service metadata and license with each council; batch ingestion only with explicit grant. Reject anonymous scraper architecture. [H-GAC GIS](https://www.h-gac.com/gis-applications-and-data). |
| OpenAddresses | Open batch ingestion architecture, but Texas coverage/completeness and source licenses vary by contributing source; cannot promise all 28 rural residences. | Address point where source supplies one. | Data is free; ingestion/refresh cost remains. | Each source license/attribution must survive into provenance. Good supplemental source, not the sole regional authority. [Sources](https://results.openaddresses.io/), [license](https://github.com/openaddresses/openaddresses/blob/master/LICENSE). |
| Overture Maps addresses/buildings | Useful open supplemental corpus and building context. Building centroids cannot be promoted to a residential address without address evidence. | Address points/building geometry with confidence/provenance varying by record. | Free data; cloud/ETL cost. | Batch ingestion allowed under release licensing, subject to source attribution/quality. Benchmark coverage per county; do not claim rooftop from a building centroid. [Schema](https://docs.overturemaps.org/schema/reference/addresses/address/), [downloads](https://docs.overturemaps.org/getting-data/). |

## 3–5. Recommendation, cost/licensing, and architecture decision

Recommend a **time-boxed Google Geocoding API production-quality pilot** behind the existing Edge Function, compared head-to-head with Smarty Rooftop before the owner signs a longer commitment. Google is selected for the implemented adapter because it provides one statewide interface and explicit `ROOFTOP` metadata rather than requiring 28 bespoke sources. This is a technical recommendation, not authorization to enable billing.

At 25,000 total monthly geocodes, if 40% reach the rural tier, 10,000 Google calls fit the historical free cap; at 50% the illustrative bill is $12.50. At 100,000 total and 40% rural, the illustrative bill is $150. These estimates exclude retries, certification, taxes and price changes. Add a spend alert, provider quota, per-origin abuse controls, and monitor rural-tier invocation rate before launch.

Final order:

```text
Nominatim/general provider (rural candidates pass LP104 gate)
  → Google authoritative rural tier (disabled until owner approval)
  → protected verified registry (exceptions only)
  → strict Census range fallback
  → truthful no-result
```

Every rural candidate must independently return the requested number and canonical road; non-conflicting state/ZIP/county; a supported county; Texas-contained coordinates; and an approved precision. Google `RANGE_INTERPOLATED` and `APPROXIMATE` are rejected. A candidate is never populated from request values. Route Preview becomes eligible only after acceptance. Consumer diagnostics contain only classifications; LP104 certification diagnostics contain agreement booleans and precision labels, never raw upstream payloads or coordinates.

Normalization treats County Road/County Rd/CR/Co Rd, FM/Farm to Market, State Highway/SH/TX, and US Highway/US as semantic equivalents only when followed by the same route number. Named roads are punctuation/case normalized but not aliased. No Web/Webb or county-specific invention exists.

## 6–8. Implementation and deployment requirements

1. Obtain owner approval and accept the selected provider agreement after counsel confirms server proxy, six-hour cache, routing to returned points on Gridly's map, attribution, privacy/deletion, and no prohibited derived database.
2. Create a server-restricted provider key. Restrict API, project, quota and budget; never use browser referrer credentials.
3. Set the secrets from `.env.lp104.example` in Supabase. Keep provider disabled until approval; rotate `GRIDLY_GEOCODE_CACHE_NAMESPACE` at activation.
4. Deploy `supabase/functions/gridly-geocode/index.ts`, then the cache-busted web assets. Confirm Edge logs redact request bodies and query strings where operationally supported.
5. Add required Google attribution/logo presentation before production if the final terms require it. This implementation does not assert that existing OSM attribution satisfies Google.
6. Run the protected multi-county plan. If Google loses to Smarty on exact rural resolution or its terms prohibit Gridly's routing/cache behavior, implement Smarty behind the same canonical provider contract rather than weakening the gate.
7. Configure quota alarms and a kill switch by setting `GRIDLY_AUTHORITATIVE_RURAL_PROVIDER=disabled`.

## 9. Owner approval required

Approval is explicitly required for: provider selection; billing account; maximum monthly spend; contract/privacy terms; cache TTL; attribution UX; protected transmission of the owner's address; and deployment of the server secret. This commit deliberately stops before all of those actions.

## 10. Exact multi-county test plan

Keep the test manifest in an encrypted/local owner-controlled file and pass it to the browser audit; never commit residence strings. Minimum live suite:

* at least two independently verified rural residential points in each of the 28 counties (56 total), with one expected resolution and one nearby wrong-number negative per road;
* every road class: County Road (all four forms), FM/Farm to Market, State Highway/SH/TX, US Highway/US, and named roads;
* at least six ZIP-only mailing-locality cases, six unincorporated-community cases, and paired points on both sides of at least four county lines;
* two real low-density cases each in Newton, Tyler, Calhoun, Matagorda, Jackson and Lavaca; two outer-rural Harris cases;
* owner residence in Liberty through protected local testing, plus the known wrong Census interpolation as a negative;
* record expected house, canonical road, county, state, ZIP, precision evidence and independently verified coordinate tolerance. Do not record those values in shared screenshots/logs.

For every positive, run exact spelling and supported semantic forms. Require the same accepted provider ID/coordinate, matching house/road, supported precision, county agreement/containment and Route Preview destination. For every negative, require zero accepted cards and no route preview. Repeat with the authoritative tier disabled to prove registry/Census ordering and mismatch rejection. Repeat after cache rotation and after six hours to cover cold/warm requests. Capture quota, latency p50/p95, provider failures and fallback outcomes as aggregates only.

Synthetic CI covers the contract and redaction but does not count as a live coverage result. Completion requires successful real positives in multiple counties, the protected Liberty validation, and eventually certification of every county if county packages replace the statewide provider.

## 11. Exact browser certification

1. Deploy the approved secret and code; hard-refresh production. Open DevTools Network and clear entries.
2. Load the protected case array locally (objects with `caseId`, `query`, and `expected: {houseNumber, road, county, postalCode}`); do not paste it into tickets or shared consoles.
3. Run `await window.gridlyLp104RegionalRuralAddressAudit?.({ cases: protectedCases, protectedLibertyValidation: true })`.
4. Confirm the returned object contains only case IDs, county labels, source classifications and agreement/containment/precision booleans—no query, address, key, coordinate, provider payload or private registry row.
5. Confirm Network shows only POSTs to Gridly `gridly-geocode`; there must be no browser call to Google, Nominatim, Census or any data portal.
6. Run `await window.gridlyLp104VisibleRegionalRuralAddressCertification?.({ cases: protectedCases, protectedLibertyValidation: true })`.
7. Require all named checks true, `failedChecks: []`, and `safeToMerge: true`. Inspect Route Preview for every positive and confirm it targets only the accepted point.
8. Preserve only the redacted certification JSON and aggregate county/pass counts. Delete local test material according to owner policy.

Until this procedure passes against an approved live provider, the honest certification result is fail-closed and LP104 is not production-complete.
