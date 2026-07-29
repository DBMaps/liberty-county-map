# LP102 Rural Address and Road Alias Investigation

## Executive summary

LP102 adds an explicitly invoked, browser-first diagnostic matrix; it does not alter production search, ranking, exactness, provider requests, or rendering. The helper exercises the real destination UI and the Gridly edge boundary, records transformations, canonical outcomes, candidate decisions, visible DOM, and route-selection agreement. No address result, alias mapping, or fallback is hardcoded.

This checkout could not reach the deployed Supabase edge endpoint because the execution environment's outbound tunnel returned HTTP 403. Consequently, repository inspection establishes the investigation mechanism and likely hypotheses but **does not establish a runtime root cause**. Merge remains on hold until the browser command below completes against production-like behavior with no failed checks.

## Problem statement and architecture reviewed

The target symptom is a truthful no-result for rural house addresses, particularly numbered Liberty County roads. The reviewed path remains Saved Places → Governed Destinations → intent classification → browser Gridly client → Gridly edge function → configured provider → canonical Gridly response → relevance/exactness gates → DOM → Route Preview. LP102 uses that same path. It neither contacts Nominatim from the browser nor exposes upstream-provider details in consumer UI.

## Query variants and controls

The matrix includes all ten required County Road 677/Web/Webb exact and road-only forms. Controls cover a known urban address, Dayton business, another numbered road, impossible rural address, out-of-area rural address, and governed Liberty Courthouse. A successful result is never encoded in the definitions; every classification comes from the current runtime response.

## Normalization findings

Existing LP101 normalization folds `County Rd`, `CR`, and `Co Rd` before a number to `county road`. The LP097 address model independently expands those county-road abbreviations for display/structured construction. The original text remains the diagnostic's `userEnteredQuery`, while punctuation, road-type, county-road, geographic extraction, provider-bound variants, canonical evaluation, and final visible outcome are separate fields.

An important investigation point is that the first address attempt is structured. The edge sends structured fields to the provider rather than its free-form `query`; later variants are free-form. The helper therefore reports browser-bound variants and explicitly labels the provider-side edge request as not browser-observable rather than pretending to have captured it.

## Alias inventory

| Family | Existing recognition/normalization | Missing or not established |
| --- | --- | --- |
| County roads | `County Road`, `County Rd`, `CR`, `Co Rd` | No permanent historical-name relationship |
| Farm-to-market | `Farm to Market`, `Farm-to-Market` punctuation handling, `FM` expansion | Not all long-form spellings produce a single canonical phrase in every layer |
| State routes | `State Highway` in LP097; `SH`/`TX` roadway identity | No broad rewrite table |
| US routes | `US Highway`/`US` recognized by roadway identity | No broad rewrite table |
| Historical aliases | None | No evidence presently connects CR 677 to Web or Webb Road |

LP102 intentionally adds no alias dataset. Web and Webb remain independent diagnostic inputs.

## Exactness and conflict review

LP097 requires house and roadway agreement plus geographic exactness for `exact_address`. Its geography governance can surface city, county, state, and ZIP conflicts; road-only candidates remain distinguishable and cannot silently become an exact house. LP102 records exact confidence and rejection reasons for each rendered candidate and preserves the relevance gate. Missing provider house metadata therefore cannot be certified as an exact address. Different locality hierarchy or mailing city must be judged from live candidate fields and conflict reasons rather than assumed.

## Provider and canonical outcome review

The client accepts only canonical Gridly payloads. A canonical `no_results` payload is a successful application outcome even though `ok` is false, and the edge returns that payload with HTTP 200. LP102 reuses the LP101.6 aggregation that separates relevant results, confirmed no-result, cooldown, temporary failure, timeout/configuration/malformed failures. Candidate precision further distinguishes exact, approximate, and road-only shapes.

## Runtime and visible behavior evidence

Run the helper only after the production search surface is loaded:

```js
await window.gridlyLp102RuralAddressInvestigation?.()
```

For a shorter diagnostic retry, pass case identifiers:

```js
await window.gridlyLp102RuralAddressInvestigation?.({
  caseNames: ["county_road_full", "web_address", "webb_address", "business_control", "governed_control"]
})
```

The helper is passive until invoked. Invocation intentionally performs searches, observes boundary evidence, captures candidate pipeline stages, compares final render input to visible cards, and selects the first accepted result once to verify Route Preview handoff. It returns `failedChecks`; `safeToProceed` cannot become true without observed requests, preserved boundary, no direct provider access, canonical classification, no misleading fallback, pipeline/DOM agreement, and a Route Preview selection.

The implementation environment's attempted edge requests failed at its outbound tunnel (`Tunnel connection failed: 403 Forbidden`) before reaching Gridly. This is an environment limitation, not provider evidence, and none of those attempts are classified as a rural-address outcome.

## Root-cause classification and ownership

Current conclusion: **inconclusive pending production browser capture**. Runtime logic will classify all exact variants returning canonical empty responses as provider address/alias coverage evidence. It will classify a canonical candidate disappearing between the Gridly candidate pipeline and visible DOM as a Gridly-controlled defect. A mixture remains visible case by case. This prevents code inspection or a plausible alias from being presented as proof.

## Patch decision and remaining limitations

No production behavior patch was justified or made. The diagnostic instrumentation is the only runtime-code change. Provider-bound structured URL parameters are edge-internal and deliberately not exposed to the browser, so the matrix marks that portion unobservable. Approximate rural acceptance remains governed by LP097; LP102 does not relax it. Provider coverage, mailing-city identity, and any CR 677 historical alias remain unknown until live results are captured.

## Manual certification

1. Open the deployed/production-like app and its developer tools.
2. Open Destination Search and confirm no unrelated console errors are present.
3. Run `await window.gridlyLp102RuralAddressInvestigation?.()` in the console.
4. Inspect every case's `normalizationTrace`, request payload, `transport`, canonical classification, candidates, rejection reasons, `candidatePipeline`, and visible outcome.
5. Confirm exact and abbreviated county-road, Web/Webb, road-only, urban, business, invalid, out-of-area, and governed controls ran.
6. Confirm Network shows browser requests only to `gridly-geocode`, never directly to Nominatim.
7. Confirm an accepted result was selected and `routePreviewPreserved` is true.
8. Confirm `failedChecks` is empty, candidate/DOM agreement is true for every case, and misleading fallbacks are absent.
9. Record the returned object as runtime evidence. If any candidate is rejected, use its explicit reasons before considering a narrowly scoped patch.

## Merge recommendation

**Hold / do not merge yet.** Run and retain the production-like browser evidence first. Merge may be recommended only when the helper returns an empty `failedChecks`, verifies Route Preview and controls, and the observed case data supports its ownership conclusion. LP102 does not provide a static-fixture visible certification helper because no production defect or justified behavior patch has yet been identified.
